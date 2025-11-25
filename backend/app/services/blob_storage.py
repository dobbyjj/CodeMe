from __future__ import annotations

from typing import BinaryIO, Optional

from azure.core.exceptions import AzureError
from azure.storage.blob import BlobServiceClient, ContainerClient, ContentSettings

from app.core.config import settings


def get_blob_container_client() -> ContainerClient:
    """
    Resolve a ContainerClient using the configured credentials.
    Connection string 우선, 없으면 account URL + key, 마지막으로 account name + key 조합을 사용.
    """
    if settings.azure_storage_connection_string:
        service = BlobServiceClient.from_connection_string(settings.azure_storage_connection_string)
    elif settings.azure_storage_account_url and settings.azure_storage_account_key:
        service = BlobServiceClient(
            account_url=settings.azure_storage_account_url,
            credential=settings.azure_storage_account_key,
        )
    elif settings.azure_storage_account_name and settings.azure_storage_account_key:
        account_url = f"https://{settings.azure_storage_account_name}.blob.core.windows.net"
        service = BlobServiceClient(account_url=account_url, credential=settings.azure_storage_account_key)
    else:
        raise RuntimeError("Azure Blob Storage credentials are not configured.")

    return service.get_container_client(settings.azure_blob_container)


def upload_blob(
    container: ContainerClient,
    blob_path: str,
    data: BinaryIO,
    content_type: Optional[str] = None,
) -> None:
    """
    Upload stream to a specific blob path.
    """
    try:
        content_settings = ContentSettings(content_type=content_type or "application/octet-stream")
        container.upload_blob(
            name=blob_path,
            data=data,
            overwrite=True,
            content_settings=content_settings,
        )
    except AzureError as exc:
        raise RuntimeError(f"Failed to upload blob: {exc}") from exc
