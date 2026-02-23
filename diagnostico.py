"""
Script de Diagnóstico - Law System
Execute este script para identificar o problema com o router

Como usar:
    cd C:\law_system
    python diagnostico.py
"""

import sys
import os

print("=" * 70)
print("🔍 DIAGNÓSTICO DO PROBLEMA - LAW SYSTEM")
print("=" * 70)
print()

# Teste 1: Verificar se os arquivos existem
print("📁 TESTE 1: Verificando estrutura de arquivos...")
print("-" * 70)

arquivos_necessarios = [
    ("main.py", "app/main.py"),
    ("update_user.py", "app/models/routes/update_user.py"),
    ("__init__ routes", "app/models/routes/__init__.py"),
    ("__init__ models", "app/models/__init__.py"),
]

for nome, caminho in arquivos_necessarios:
    existe = os.path.exists(caminho)
    status = "✅ EXISTE" if existe else "❌ NÃO EXISTE"
    print(f"{status:15} {caminho}")
    
print()

# Teste 2: Tentar importar o módulo
print("📦 TESTE 2: Testando imports...")
print("-" * 70)

try:
    from app.models.routes import update_user
    print("✅ Import 'from app.models.routes import update_user' funcionou!")
    print(f"   Tipo: {type(update_user)}")
    
    if hasattr(update_user, 'router'):
        print("✅ update_user.router existe!")
        print(f"   Tipo do router: {type(update_user.router)}")
        
        # Verificar rotas no router
        if hasattr(update_user.router, 'routes'):
            print(f"   Número de rotas: {len(update_user.router.routes)}")
            for route in update_user.router.routes:
                if hasattr(route, 'path') and hasattr(route, 'methods'):
                    print(f"   - {list(route.methods)} {route.path}")
    else:
        print("❌ update_user.router NÃO existe!")
        
except ImportError as e:
    print(f"❌ ERRO no import: {e}")
    print()
    print("🔧 POSSÍVEIS CAUSAS:")
    print("   1. Arquivo __init__.py faltando em app/models/routes/")
    print("   2. Erro de sintaxe no update_user.py")
    print("   3. Dependências faltando")
    
except Exception as e:
    print(f"❌ ERRO INESPERADO: {e}")
    import traceback
    traceback.print_exc()

print()

# Teste 3: Verificar conteúdo do __init__.py
print("📄 TESTE 3: Verificando conteúdo dos __init__.py...")
print("-" * 70)

init_files = [
    "app/models/__init__.py",
    "app/models/routes/__init__.py"
]

for init_file in init_files:
    if os.path.exists(init_file):
        print(f"\n📄 {init_file}:")
        with open(init_file, 'r', encoding='utf-8') as f:
            content = f.read()
            if content.strip():
                print(f"   Conteúdo: {content[:200]}")
            else:
                print("   ⚠️ ARQUIVO VAZIO (isso é OK)")
    else:
        print(f"\n❌ {init_file}: NÃO EXISTE")

print()

# Teste 4: Verificar imports no main.py
print("📄 TESTE 4: Verificando import no main.py...")
print("-" * 70)

if os.path.exists("app/main.py"):
    with open("app/main.py", 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    # Procurar pelo import
    import_encontrado = False
    include_router_encontrado = False
    
    for i, line in enumerate(lines, 1):
        if 'from app.models.routes import update_user' in line:
            print(f"✅ Linha {i}: {line.strip()}")
            import_encontrado = True
            
        if 'app.include_router(update_user' in line or 'include_router(update_user' in line:
            print(f"📍 Linha {i}: {line.strip()}")
            include_router_encontrado = True
            
            # Verificar as próximas 3 linhas para ver se tem prefix
            tem_prefix = False
            for j in range(i, min(i+4, len(lines))):
                if 'prefix=' in lines[j]:
                    print(f"   Linha {j+1}: {lines[j].strip()}")
                    tem_prefix = True
                    if '"/users"' in lines[j] or "'/users'" in lines[j]:
                        print("   ✅ PREFIX CORRETO: /users")
                    else:
                        print("   ⚠️ PREFIX INCORRETO ou FALTANDO")
            
            if not tem_prefix:
                print("   ❌ PREFIX NÃO ENCONTRADO!")
    
    if not import_encontrado:
        print("❌ Import do update_user NÃO encontrado no main.py!")
        
    if not include_router_encontrado:
        print("❌ include_router do update_user NÃO encontrado no main.py!")

print()

# Teste 5: Verificar sintaxe do update_user.py
print("📄 TESTE 5: Verificando sintaxe do update_user.py...")
print("-" * 70)

if os.path.exists("app/models/routes/update_user.py"):
    try:
        with open("app/models/routes/update_user.py", 'r', encoding='utf-8') as f:
            code = f.read()
        compile(code, "app/models/routes/update_user.py", "exec")
        print("✅ Sintaxe do update_user.py está CORRETA")
        
        # Verificar se tem router definido
        if 'router = APIRouter()' in code or 'router=APIRouter()' in code:
            print("✅ router = APIRouter() encontrado")
        else:
            print("❌ router = APIRouter() NÃO encontrado!")
            
        # Verificar se tem a rota
        if '@router.put' in code:
            print("✅ @router.put encontrado")
            # Extrair o path
            import re
            matches = re.findall(r'@router\.put\(["\']([^"\']+)["\']', code)
            if matches:
                print(f"   Paths encontrados: {matches}")
        else:
            print("❌ @router.put NÃO encontrado!")
            
    except SyntaxError as e:
        print(f"❌ ERRO DE SINTAXE no update_user.py:")
        print(f"   Linha {e.lineno}: {e.msg}")
    except Exception as e:
        print(f"❌ ERRO ao verificar: {e}")
else:
    print("❌ Arquivo app/models/routes/update_user.py NÃO EXISTE!")

print()
print("=" * 70)
print("🎯 RESUMO DO DIAGNÓSTICO")
print("=" * 70)
print()
print("Execute este script e me envie o resultado completo!")
print("Isso me ajudará a identificar exatamente onde está o problema.")
print()