from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from uuid import UUID
from app.database import get_db
from app.models.user import User
from app.models.schemas.user_schema import UserUpdate, UserResponse
from config import settings

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# ==========================================
# DEPENDÊNCIA: OBTER USUÁRIO ATUAL
# ==========================================
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")

        user = db.query(User).filter(User.id == user_id).first()

        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")

        return user

    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

# ==========================================
# ENDPOINT: ATUALIZAR PERFIL (ME)
# ==========================================
@router.put("/me/update", response_model=UserResponse)
async def update_user_profile(
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    update_data = user_data.model_dump(exclude_unset=True)

    # TRATAMENTO CPF
    if 'cpf' in update_data:
        cpf_limpo = ''.join(filter(str.isdigit, update_data['cpf']))

        if current_user.cpf and cpf_limpo != current_user.cpf:
            raise HTTPException(status_code=400, detail="O CPF não pode ser alterado.")

        update_data['cpf'] = cpf_limpo

    # TRATAMENTO TELEFONE
    if 'phone' in update_data:
        update_data['phone'] = ''.join(filter(str.isdigit, update_data['phone']))

    # ATUALIZA CAMPOS DINAMICAMENTE
    for key, value in update_data.items():
        if hasattr(current_user, key):
            setattr(current_user, key, value)

    try:
        db.commit()
        db.refresh(current_user)
        return current_user

    except Exception as e:
        db.rollback()
        print(f"❌ ERRO NO COMMIT: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro interno ao salvar os dados.")

# ==========================================
# ENDPOINT: REJEITAR ACESSO (EXCLUIR USUÁRIO)
# ==========================================
@router.delete("/admin/users/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Regra de Ouro: Apenas administradores podem excluir usuários
    if current_user.role != 'admin':
        raise HTTPException(
            status_code=403, 
            detail="Acesso negado. Apenas administradores podem rejeitar acessos."
        )

    # Localiza o usuário alvo no banco
    user_to_delete = db.query(User).filter(User.id == user_id).first()

    if not user_to_delete:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # Proteção: Impede que o admin exclua a si próprio
    if user_to_delete.id == current_user.id:
        raise HTTPException(
            status_code=400, 
            detail="Operação inválida. Você não pode excluir sua própria conta administrativa."
        )

    try:
        db.delete(user_to_delete)
        db.commit()
        # Em DELETE, retornar 204 significa sucesso total sem conteúdo de retorno
        return None 

    except Exception as e:
        db.rollback()
        print(f"❌ ERRO AO DELETAR USUÁRIO: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro interno ao remover o usuário do banco.")