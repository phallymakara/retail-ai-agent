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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()