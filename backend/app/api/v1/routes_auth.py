import httpx
from fastapi.responses import RedirectResponse

from app.core.config import settings
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.schemas.auth import SignupRequest, LoginRequest, Token
from app.schemas.user import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/google/login")
def google_login():
    """
    구글 로그인 페이지로 리다이렉트
    """
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
        # TODO: state를 세션/쿠키에 저장해서 CSRF 방어까지 하고 싶으면 여기서 추가
    }

    from urllib.parse import urlencode

    url = f"{settings.google_auth_base_url}?{urlencode(params)}"
    return RedirectResponse(url)

@router.get("/google/callback", response_model=Token)
async def google_callback(
    code: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    구글에서 돌아온 code로 토큰 교환 + user 생성/로그인 + 우리 JWT 발급
    """
    # 1) code -> 토큰 교환
    data = {
        "code": code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": settings.google_redirect_uri,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(settings.google_token_url, data=data)
        if token_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange code for token",
            )

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No access token in response",
            )

        # 2) access_token으로 유저 정보 가져오기
        userinfo_resp = await client.get(
            settings.google_userinfo_url,
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if userinfo_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to fetch user info",
            )

        userinfo = userinfo_resp.json()
        email = userinfo.get("email")
        name = userinfo.get("name")

        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google account has no email",
            )

    # 3) DB에서 사용자 조회/생성
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # 새 구글 사용자 생성
        from app.core.security import hash_password

        # 실제로는 랜덤 문자열을 해시해 두거나, "google-login" 같은 플래그용 더미 비번
        dummy_password = hash_password("google-login")
        user = User(
            email=email,
            password_hash=dummy_password,
            name=name,
            provider="google",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # 기존 로컬 계정이 있으면, provider를 google로 업데이트해도 되고,
        # 그대로 두고 email 기반으로 로그인만 허용해도 됨.
        if user.provider != "google":
            user.provider = "google"
            db.commit()
            db.refresh(user)

    # 4) 우리 서비스용 JWT 발급
    access_token = create_access_token(str(user.id))
    return Token(access_token=access_token)