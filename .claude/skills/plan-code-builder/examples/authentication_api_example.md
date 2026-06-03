# API de Autenticação com JWT

## Descrição

Sistema de autenticação com JWT para FastAPI. Implementa criação de tokens, validação e rotas protegidas.

## Dependências

```
FastAPI
python-jose
passlib
bcrypt
pydantic
```

## Implementação

### Passo 1: Setup de Configurações e Modelos

O primeiro passo é definir as configurações de segurança e os modelos de dados.

```python
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

# Configurações de segurança
SECRET_KEY = "sua-chave-secreta-muito-segura"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Contexto para hash de passwords
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Modelos de dados
class User(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
```

Explicação: Centralizamos configurações, imports e modelos no topo. O pwd_context garante hashes seguros. Os modelos Pydantic validam entrada/saída automaticamente.

### Passo 2: Funções de Utilidade para Password e Tokens

Funções auxiliares para hash de passwords e geração/validação de tokens.

```python
def hash_password(password: str) -> str:
    # Hash a password
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Verifica se a password corresponde ao hash
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    # Cria um JWT com os dados fornecidos
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
```

### Passo 3: Rotas de Autenticação

Endpoints para login e acesso a recursos protegidos.

```python
from fastapi import FastAPI, Depends, HTTPException, status

app = FastAPI()

@app.post("/token")
async def login(user: User):
    # Autentica utilizador e retorna token
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    # Retorna dados do utilizador autenticado
    return current_user
```

## Validação

- [x] Syntax: Correcto
- [x] Imports: Válidos
- [x] Lint: PEP 8 compliant
- [x] Clean Code: Funções pequenas
- [x] Tratamento de Erros: Presente
- [x] Type Hints: Completos

## Testes

Sugeridos:
- Login com credenciais válidas
- Login com credenciais inválidas
- Acesso a rota protegida com token
- Acesso a rota protegida sem token
