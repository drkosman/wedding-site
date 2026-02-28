import os

# // URL for the db
DATABASE_URL = os.getenv("DATABASE_URL")

#  // Bool for deployment var
IS_DEV = os.getenv("DEV_MODE", "true").lower() == "false"