import json

from pydantic import AnyHttpUrl, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    # Azure openai connection
    OPENAI_API_KEY: SecretStr
    OPENAI_BASE_URL: AnyHttpUrl
    AZURE_AI_MODEL_DEPLOYMENT_NAME: str

    # Database conection
    DATABASE_URL: SecretStr

    # Azure conection
    AZURE_STORAGE_CONNECTION_STRING: SecretStr
    AZURE_STORAGE_CONTAINER_NAME: str = "product-images"

    # Agent timeout
    AGENT_TIMEOUT_SECONDS: float = 30

    # CORS — comma-separated or JSON array
    ALLOWED_ORIGINS: str = ",".join([
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ])

    @property
    def allowed_origins_list(self) -> list[str]:
        raw = self.ALLOWED_ORIGINS.strip()
        if raw.startswith("["):
            return json.loads(raw)
        return [o.strip() for o in raw.split(",") if o.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()