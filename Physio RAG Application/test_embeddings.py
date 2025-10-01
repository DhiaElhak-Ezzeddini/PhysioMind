import os , textwrap
from supabase import create_client,Client
from openai import OpenAI
from dotenv import load_dotenv,find_dotenv

load_dotenv(find_dotenv(usecwd=True))

