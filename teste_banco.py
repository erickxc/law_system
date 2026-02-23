from sqlalchemy import create_engine, inspect
from config import settings

def inspect_structure():
    engine = create_engine(settings.DATABASE_URL)
    inspector = inspect(engine)
    
    # Lista todos os schemas disponíveis
    schemas = inspector.get_schema_names()
    print(f"📂 Schemas encontrados: {schemas}\n")

    # Focaremos nos schemas que você está usando (core, public, etc.)
    target_schemas = ['core', 'public'] # Adicione outros se houver
    
    for schema in target_schemas:
        if schema not in schemas:
            continue
            
        print(f"--- SCHEMA: {schema} ---")
        tables = inspector.get_table_names(schema=schema)
        
        for table in tables:
            print(f"\n📌 Tabela: {table}")
            
            # Colunas
            columns = inspector.get_columns(table, schema=schema)
            for col in columns:
                pk = "🔑 PK" if col.get('primary_key') else ""
                nullable = "NULL" if col['nullable'] else "NOT NULL"
                print(f"  - {col['name']}: {col['type']} ({nullable}) {pk}")
            
            # Chaves Estrangeiras (FKs)
            fks = inspector.get_foreign_keys(table, schema=schema)
            for fk in fks:
                print(f"  🔗 FK: {fk['constrained_columns']} -> {fk['referred_table']}.{fk['referred_columns']}")
        print("\n" + "="*30 + "\n")

if __name__ == "__main__":
    try:
        inspect_structure()
    except Exception as e:
        print(f"❌ Erro ao conectar: {e}")