from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session, select
from typing import Any
from uuid import UUID

from apps.api.database import get_session
from apps.api.models import Client, User
from apps.api import schemas, auth

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)

@router.post("/login", response_model=schemas.LoginResponse)
async def login_by_id(
    client_id: UUID, 
    session: Session = Depends(get_session)
):
    """
    Direct login by client_id. In a real production app, 
    this would also require a client_secret or similar.
    """
    client = session.get(Client, client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid client ID",
        )
    
    access_token = auth.create_access_token(data={"sub": str(client.id)})
    return {
        "client": client,
        "token": {"access_token": access_token, "token_type": "bearer"}
    }

@router.post("/setup", response_model=schemas.LoginResponse)
async def setup_account(
    setup: schemas.AccountSetupRequest, 
    session: Session = Depends(get_session)
):
    """Creates a new Client and its first User."""
    # Check if user already exists
    existing_user = session.exec(select(User).where(User.email == setup.user_email)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # Create Client
    new_client = Client(
        name=setup.client_name,
        sso_domain=setup.sso_domain,
        sso_enabled=bool(setup.sso_domain)
    )
    session.add(new_client)
    session.flush() # Get client ID

    # Create User
    new_user = User(
        email=setup.user_email,
        full_name=setup.user_full_name,
        client_id=new_client.id
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_client)
    session.refresh(new_user)

    access_token = auth.create_access_token(data={
        "sub": str(new_client.id),
        "user_id": str(new_user.id)
    })
    
    return {
        "client": new_client,
        "token": {"access_token": access_token, "token_type": "bearer"}
    }

@router.get("/sso/login")
async def sso_login(request: Request):
    """Initiates Auth0 login flow."""
    if not auth.AUTH0_DOMAIN:
        raise HTTPException(status_code=501, detail="SSO Not Configured")
    redirect_uri = request.url_for('auth0_callback')
    return await auth.oauth.auth0.authorize_redirect(request, str(redirect_uri))

@router.get("/sso/callback", name='auth0_callback')
async def auth0_callback(request: Request, session: Session = Depends(get_session)):
    """Handles Auth0 callback and maps user to Client by domain."""
    if not auth.AUTH0_DOMAIN:
        raise HTTPException(status_code=501, detail="SSO Not Configured")
    token = await auth.oauth.auth0.authorize_access_token(request)
    user_info = token.get('userinfo')
    if not user_info:
        raise HTTPException(status_code=400, detail="Failed to retrieve user info from Auth0")
    
    email = user_info.get('email')
    if not email or '@' not in email:
        raise HTTPException(status_code=400, detail="Invalid email from Auth0")
    
    domain = email.split('@')[1]
    
    # Find client by domain
    client = session.exec(select(Client).where(Client.sso_domain == domain, Client.sso_enabled == True)).first()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No client found with SSO enabled for domain: {domain}",
        )
    
    # Find or create user
    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        user = User(
            email=email,
            full_name=user_info.get('name') or email,
            client_id=client.id
        )
        session.add(user)
        session.commit()
        session.refresh(user)

    access_token = auth.create_access_token(data={
        "sub": str(client.id),
        "user_id": str(user.id)
    })
    
    # Redirect to frontend with token
    return {
        "client": client,
        "token": {"access_token": access_token, "token_type": "bearer"}
    }
