import subprocess
import os
import datetime
from config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

def narrar(msg):
    print(f"[*] {msg}")

def executar_backup():
    # Nome dinâmico para não sobrescrever
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M")
    arquivo_saida = f"backup_law_study_{timestamp}.backup"
    
    # Define a senha para o superusuário postgres
    os.environ['PGPASSWORD'] = DB_PASSWORD
    
    print("\n--- INICIANDO BACKUP DE SEGURANÇA (NÍVEL ADMIN) ---")
    narrar(f"Autenticando como superusuário: {DB_USER}")
    narrar(f"Extraindo base completa: {DB_NAME}")

    comando = [
        'pg_dump',
        '-h', DB_HOST,
        '-p', DB_PORT,
        '-U', DB_USER,
        '-F', 'c',
        '-f', arquivo_saida,
        DB_NAME
    ]

    try:
        # Executa o dump
        subprocess.run(comando, check=True)
        
        tamanho = os.path.getsize(arquivo_saida) / (1024 * 1024)
        print(f"\n[SUCESSO] Backup realizado com permissões de administrador!")
        print(f"[ARQUIVO] {os.path.abspath(arquivo_saida)}")
        print(f"[TAMANHO] {tamanho:.2f} MB")
        
    except subprocess.CalledProcessError as e:
        print(f"\n[ERRO] Falha no pg_dump. Verifique se a senha 'supertux' está correta.")
    finally:
        if 'PGPASSWORD' in os.environ:
            del os.environ['PGPASSWORD']

if __name__ == "__main__":
    executar_backup()