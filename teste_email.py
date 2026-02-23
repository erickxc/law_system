# test_email.py
import smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv
import os

load_dotenv()

SMTP_SERVER = os.getenv("SMTP_SERVER")
SMTP_PORT = int(os.getenv("SMTP_PORT"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")

print(f"📧 Testando envio de e-mail...")
print(f"SMTP: {SMTP_SERVER}:{SMTP_PORT}")
print(f"User: {SMTP_USER}")
print(f"Para: {ADMIN_EMAIL}")

try:
    msg = MIMEText("Teste de e-mail do Law System", 'plain', 'utf-8')
    msg['Subject'] = "🧪 Teste - Law System"
    msg['From'] = SMTP_USER
    msg['To'] = ADMIN_EMAIL
    
    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)
    
    print("✅ E-mail enviado com sucesso!")
    
except Exception as e:
    print(f"❌ Erro: {str(e)}")