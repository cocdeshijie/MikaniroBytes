import enum


class StorageType(str, enum.Enum):
    LOCAL = "local"
    # AWS_S3 = "aws_s3"
    # FTP = "ftp"
    # You can add more as needed (e.g., GCP, Azure, etc.)


class FileType(str, enum.Enum):
    BASE = "base"
    IMAGE = "image"
    # Future expansions: VIDEO, AUDIO, PDF, THREE_D, etc.
