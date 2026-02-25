from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from collections import defaultdict
import uuid
from sqlalchemy import create_engine, Column, String, Float, ForeignKey, Table, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session
import os

# ----- DATABASE SETUP -----
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./hisab.db"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

SQLALCHEMY_DATABASE_URL = DATABASE_URL
connect_args = {"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Many-to-Many Association Table between Users and Groups
user_groups = Table('user_groups', Base.metadata,
    Column('user_id', String, ForeignKey('users.id')),
    Column('group_id', String, ForeignKey('groups.id'))
    # Optional: Column('role', String, default='member')
)

class DBUser(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)  # plaintext for prototype
    groups = relationship("DBGroup", secondary=user_groups, back_populates="members")

class DBGroup(Base):
    __tablename__ = "groups"
    id = Column(String, primary_key=True, index=True)
    unique_name = Column(String, unique=True, index=True) # group username
    display_name = Column(String)
    group_type = Column(String, default="smart_meal")
    manager_id = Column(String, ForeignKey("users.id"))
    members = relationship("DBUser", secondary=user_groups, back_populates="groups")
    expenses = relationship("DBExpense", back_populates="group")
    meals = relationship("DBMeal", back_populates="group")
    funds = relationship("DBFund", back_populates="group")
    roles = relationship("DBGroupRole", back_populates="group")

class DBGroupRole(Base):
    __tablename__ = "group_roles"
    id = Column(String, primary_key=True, index=True)
    group_id = Column(String, ForeignKey("groups.id"))
    user_id = Column(String, ForeignKey("users.id"))
    is_manager = Column(Boolean, default=False)
    title = Column(String, default="Member")
    group = relationship("DBGroup", back_populates="roles")

class DBExpense(Base):
    __tablename__ = "expenses"
    id = Column(String, primary_key=True, index=True)
    group_id = Column(String, ForeignKey("groups.id"))
    user_id = Column(String, ForeignKey("users.id"))
    amount = Column(Float)
    category = Column(String)
    date = Column(String)
    items = Column(String, default="")
    group = relationship("DBGroup", back_populates="expenses")
    user = relationship("DBUser")

class DBMeal(Base):
    __tablename__ = "meals"
    id = Column(String, primary_key=True, index=True)
    group_id = Column(String, ForeignKey("groups.id"))
    user_id = Column(String, ForeignKey("users.id"))
    date = Column(String)
    breakfast = Column(Float, default=0)
    lunch = Column(Float, default=0)
    dinner = Column(Float, default=0)
    guest_meal_count = Column(Float, default=0)
    group = relationship("DBGroup", back_populates="meals")
    user = relationship("DBUser")

class DBFund(Base):
    __tablename__ = "funds"
    id = Column(String, primary_key=True, index=True)
    group_id = Column(String, ForeignKey("groups.id"))
    user_id = Column(String, ForeignKey("users.id"))
    amount = Column(Float)
    date = Column(String)
    group = relationship("DBGroup", back_populates="funds")
    user = relationship("DBUser")

class DBPersonalCash(Base):
    __tablename__ = "personal_cash"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String)
    ami_pai = Column(Float, default=0.0)
    se_pay = Column(Float, default=0.0)
    user = relationship("DBUser")

class DBNotification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    message = Column(String)
    is_read = Column(Boolean, default=False)
    created_at = Column(String)

class DBMealRequest(Base):
    __tablename__ = "meal_requests"
    id = Column(String, primary_key=True, index=True)
    group_id = Column(String, ForeignKey("groups.id"))
    user_id = Column(String, ForeignKey("users.id"))
    date = Column(String)
    status = Column(String, default="pending") 
    message = Column(String)
    group = relationship("DBGroup")
    user = relationship("DBUser")

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ----- APP INITIALIZATION -----
app = FastAPI(title="Vara Bhagabhagi Persistent API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----- PYDANTIC SCHEMAS -----
class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserUpdate(BaseModel):
    username: str
    email: str

class UserLogin(BaseModel):
    email: str
    password: str

class GroupCreate(BaseModel):
    unique_name: str
    display_name: str
    user_id: str  # the creator
    group_type: str = "smart_meal"

class JoinGroup(BaseModel):
    group_unique_name: str
    user_id: str

class ExpenseCreate(BaseModel):
    group_id: str
    user_id: str
    amount: float
    category: str
    date: str
    items: str = ""

class MealCreate(BaseModel):
    group_id: str
    user_id: str
    date: str
    breakfast: float = 0.0
    lunch: float = 0.0
    dinner: float = 0.0
    dinner: float = 0.0
    guest_meal_count: float = 0.0

class FundCreate(BaseModel):
    group_id: str
    user_id: str
    amount: float
    date: str

class FundUpdate(BaseModel):
    amount: float
    date: str

class MealUpdate(BaseModel):
    breakfast: Optional[float] = None
    lunch: Optional[float] = None
    dinner: Optional[float] = None
    guest_meal_count: Optional[float] = None

class PersonalCashCreate(BaseModel):
    name: str
    ami_pai: float = 0.0
    se_pay: float = 0.0

class PersonalCashUpdate(BaseModel):
    name: Optional[str] = None
    ami_pai: Optional[float] = None
    se_pay: Optional[float] = None

class RoleUpdate(BaseModel):
    user_id: str
    is_manager: bool
    title: str

class MealRequestCreate(BaseModel):
    group_id: str
    user_id: str
    date: str
    message: str

class MealRequestUpdate(BaseModel):
    status: str

# ----- ROUTES -----
@app.post("/api/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(DBUser).filter(DBUser.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(DBUser).filter(DBUser.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = DBUser(id=str(uuid.uuid4()), username=user.username, email=user.email, password=user.password)
    db.add(new_user)
    db.commit()
    return {"id": new_user.id, "username": new_user.username, "email": new_user.email}

@app.post("/api/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(DBUser).filter(DBUser.email == user.email, DBUser.password == user.password).first()
    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    return {"id": db_user.id, "username": db_user.username, "email": db_user.email}

@app.put("/api/users/{user_id}")
def update_user(user_id: str, data: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if data.username != user.username:
        if db.query(DBUser).filter(DBUser.username == data.username).first():
            raise HTTPException(status_code=400, detail="Username already taken")
        user.username = data.username
        
    if data.email != user.email:
        if db.query(DBUser).filter(DBUser.email == data.email).first():
            raise HTTPException(status_code=400, detail="Email already taken")
        user.email = data.email
        
    db.commit()
    return {"id": user.id, "username": user.username, "email": user.email}

@app.get("/api/users/{user_id}/groups")
def get_user_groups(user_id: str, db: Session = Depends(get_db)):
    db_user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return [
        {"id": g.id, "unique_name": g.unique_name, "display_name": g.display_name, "group_type": g.group_type, "manager_id": g.manager_id} 
        for g in db_user.groups
    ]

@app.post("/api/groups")
def create_group(group: GroupCreate, db: Session = Depends(get_db)):
    if db.query(DBGroup).filter(DBGroup.unique_name == group.unique_name).first():
        raise HTTPException(status_code=400, detail="Group username matches an existing group. Try another.")
    
    db_user = db.query(DBUser).filter(DBUser.id == group.user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    new_group = DBGroup(id=str(uuid.uuid4()), unique_name=group.unique_name, display_name=group.display_name, group_type=group.group_type, manager_id=group.user_id)
    new_group.members.append(db_user) # Auto-add creator
    
    # Add creator as Manager role
    creator_role = DBGroupRole(id=str(uuid.uuid4()), group_id=new_group.id, user_id=group.user_id, is_manager=True, title="Manager")
    db.add(creator_role)
    
    db.add(new_group)
    db.commit()
    return {"id": new_group.id, "unique_name": new_group.unique_name, "display_name": new_group.display_name, "group_type": new_group.group_type, "manager_id": new_group.manager_id}

@app.post("/api/groups/join")
def join_group(data: JoinGroup, db: Session = Depends(get_db)):
    group = db.query(DBGroup).filter(DBGroup.unique_name == data.group_unique_name).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found. Check the unique username.")
    
    user = db.query(DBUser).filter(DBUser.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user in group.members:
        raise HTTPException(status_code=400, detail="You are already in this group!")
        
    group.members.append(user)
    
    # Add as Member role
    member_role = DBGroupRole(id=str(uuid.uuid4()), group_id=group.id, user_id=user.id, is_manager=False, title="Member")
    db.add(member_role)
    
    db.commit()
    return {"id": group.id, "unique_name": group.unique_name, "display_name": group.display_name, "group_type": group.group_type, "manager_id": group.manager_id}

@app.delete("/api/groups/{group_id}")
def delete_group(group_id: str, db: Session = Depends(get_db)):
    group = db.query(DBGroup).filter(DBGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    db.query(DBGroupRole).filter(DBGroupRole.group_id == group_id).delete()
    db.query(DBExpense).filter(DBExpense.group_id == group_id).delete()
    db.query(DBMeal).filter(DBMeal.group_id == group_id).delete()
    db.query(DBFund).filter(DBFund.group_id == group_id).delete()
    group.members.clear()
    
    db.delete(group)
    db.commit()
    return {"message": "Group deleted successfully"}

@app.delete("/api/groups/{group_id}/members/{user_id}")
def remove_member(group_id: str, user_id: str, db: Session = Depends(get_db)):
    group = db.query(DBGroup).filter(DBGroup.id == group_id).first()
    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not group or not user:
        raise HTTPException(status_code=404, detail="Not found")
    
    if user in group.members:
        group.members.remove(user)
    db.query(DBGroupRole).filter(DBGroupRole.group_id == group_id, DBGroupRole.user_id == user_id).delete()
    db.commit()
    return {"message": "Member removed"}

# Core Logic Engine (same as before but adapted for SQLAlchemy models)
def calculate_dashboard_metrics(group: DBGroup):
    members = group.members
    expenses = group.expenses
    meals = group.meals

    total_bazar = sum(e.amount for e in expenses if e.category.startswith('Bazar'))
    total_meals = sum(m.breakfast + m.lunch + m.dinner + m.guest_meal_count for m in meals)
    meal_rate = round(total_bazar / total_meals, 2) if total_meals > 0 else 0.0
    fixed_expenses = sum(e.amount for e in expenses if e.category in ['Rent', 'Utilities'])

    balances = defaultdict(float)
    # Credits
    for e in expenses:
        balances[e.user_id] += e.amount

    if group.group_type == "monthly_avg":
        total_expenses = sum(e.amount for e in expenses)
        if members:
            per_person_cost = total_expenses / len(members)
            for m in members:
                balances[m.id] -= per_person_cost
    else:
        # Debits for meals
        for m in meals:
            total_user_meals = m.breakfast + m.lunch + m.dinner + m.guest_meal_count
            balances[m.user_id] -= (total_user_meals * meal_rate)

        # Fixed Expenses
        if members:
            per_person_fixed = fixed_expenses / len(members)
            for m in members:
                balances[m.id] -= per_person_fixed

    # Funds / Deposits
    funds = group.funds
    for f in funds:
        balances[f.user_id] += f.amount
        if group.manager_id:
            balances[group.manager_id] -= f.amount

    balances_rounded = {uid: round(amt, 2) for uid, amt in balances.items()}
    
    # Missing members shouldn't break the dict
    for member in members:
        if member.id not in balances_rounded:
            balances_rounded[member.id] = 0.0

    # Smart Settlement
    debtors = [{'user': uid, 'amount': -amt} for uid, amt in balances_rounded.items() if amt < -0.01]
    creditors = [{'user': uid, 'amount': amt} for uid, amt in balances_rounded.items() if amt > 0.01]
    debtors.sort(key=lambda x: x['amount'], reverse=True)
    creditors.sort(key=lambda x: x['amount'], reverse=True)

    transactions = []
    i, j = 0, 0
    while i < len(debtors) and j < len(creditors):
        debtor = debtors[i]
        creditor = creditors[j]
        settle_amount = min(debtor['amount'], creditor['amount'])
        transactions.append({
            "from_id": debtor['user'],
            "to_id": creditor['user'],
            "amount": round(settle_amount, 2)
        })
        debtor['amount'] -= settle_amount
        creditor['amount'] -= settle_amount
        if debtor['amount'] < 0.01: i += 1
        if creditor['amount'] < 0.01: j += 1

    roles_dict = {r.user_id: r for r in group.roles}
    user_names = {m.id: m.username for m in members}
    user_details = []
    
    for uid, bal in balances_rounded.items():
        if uid in user_names:
            r = roles_dict.get(uid)
            is_manager = r.is_manager if r else (group.manager_id == uid)
            title = r.title if r else ("Manager" if group.manager_id == uid else "Member")
            user_details.append({
                "user_id": uid, 
                "name": user_names.get(uid, "Unknown"), 
                "balance": bal, 
                "status": "Owes" if bal < 0 else "Gets Back",
                "is_manager": is_manager,
                "title": title
            })

    settlements = [
        {"from_name": user_names.get(t['from_id']), "to_name": user_names.get(t['to_id']), "amount": t['amount']}
        for t in transactions
    ]
    return {
        "manager_id": group.manager_id,
        "group_type": group.group_type,
        "total_user_meals": {uid: sum(m.breakfast + m.lunch + m.dinner + m.guest_meal_count for m in meals if m.user_id == uid) for uid in user_names.keys()},
        "summary": {
            "meal_rate": meal_rate,
            "total_bazar": total_bazar,
            "total_meals": total_meals,
            "total_fixed_expenses": fixed_expenses
        },
        "users": user_details,
        "settlements": settlements,
        "raw_expenses": [{"id": e.id, "amount": e.amount, "category": e.category, "date": e.date, "items": e.items, "user": user_names.get(e.user_id), "user_id": e.user_id} for e in expenses],
        "meals": [{"id": m.id, "date": m.date, "user": user_names.get(m.user_id), "user_id": m.user_id, "breakfast": m.breakfast, "lunch": m.lunch, "dinner": m.dinner, "guest_meal_count": m.guest_meal_count} for m in meals],
        "funds": [{"id": f.id, "amount": f.amount, "date": f.date, "user": user_names.get(f.user_id), "user_id": f.user_id} for f in funds]
    }

@app.get("/api/groups/{group_id}/dashboard")
def get_dashboard(group_id: str, db: Session = Depends(get_db)):
    group = db.query(DBGroup).filter(DBGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return calculate_dashboard_metrics(group)

@app.put("/api/groups/{group_id}/roles")
def update_role(group_id: str, data: RoleUpdate, db: Session = Depends(get_db)):
    role = db.query(DBGroupRole).filter(DBGroupRole.group_id == group_id, DBGroupRole.user_id == data.user_id).first()
    if not role:
        # Create it if it doesn't exist (e.g., from old database)
        role = DBGroupRole(id=str(uuid.uuid4()), group_id=group_id, user_id=data.user_id, is_manager=data.is_manager, title=data.title)
        db.add(role)
    else:
        role.is_manager = data.is_manager
        role.title = data.title
    db.commit()
    return {"message": "Role updated successfully"}

@app.post("/api/groups/{group_id}/expenses")
def add_expense(group_id: str, expense: ExpenseCreate, db: Session = Depends(get_db)):
    import datetime
    new_expense = DBExpense(
        id=str(uuid.uuid4()), group_id=group_id, user_id=expense.user_id,
        amount=expense.amount, category=expense.category, date=expense.date, items=expense.items
    )
    db.add(new_expense)
    
    group = db.query(DBGroup).filter(DBGroup.id == group_id).first()
    user = db.query(DBUser).filter(DBUser.id == expense.user_id).first()
    if group and user:
        for m in group.members:
            if m.id != user.id:
                n = DBNotification(id=str(uuid.uuid4()), user_id=m.id, message=f"New expense of {expense.amount} BDT added by {user.username}: {expense.category}", created_at=datetime.datetime.now().isoformat())
                db.add(n)
                
    db.commit()
    return {"message": "Expense added successfully"}

@app.post("/api/groups/{group_id}/funds")
def add_fund(group_id: str, fund: FundCreate, db: Session = Depends(get_db)):
    import datetime
    new_fund = DBFund(
        id=str(uuid.uuid4()), group_id=group_id, user_id=fund.user_id,
        amount=fund.amount, date=fund.date
    )
    db.add(new_fund)
    
    group = db.query(DBGroup).filter(DBGroup.id == group_id).first()
    user = db.query(DBUser).filter(DBUser.id == fund.user_id).first()
    if group and user:
        for m in group.members:
            if m.id != user.id:
                n = DBNotification(id=str(uuid.uuid4()), user_id=m.id, message=f"{user.username} deposited {fund.amount} BDT to fund.", created_at=datetime.datetime.now().isoformat())
                db.add(n)
                
    db.commit()
    return {"message": "Fund added successfully"}

@app.put("/api/groups/{group_id}/funds/{fund_id}")
def update_fund(group_id: str, fund_id: str, fund: FundUpdate, db: Session = Depends(get_db)):
    db_fund = db.query(DBFund).filter(DBFund.id == fund_id, DBFund.group_id == group_id).first()
    if not db_fund:
        raise HTTPException(status_code=404, detail="Fund not found")
    db_fund.amount = fund.amount
    db_fund.date = fund.date
    db.commit()
    return {"message": "Fund updated successfully"}

@app.post("/api/groups/{group_id}/meals")
def add_meal(group_id: str, meal: MealCreate, db: Session = Depends(get_db)):
    new_meal = DBMeal(
        id=str(uuid.uuid4()), group_id=group_id, user_id=meal.user_id,
        date=meal.date, breakfast=meal.breakfast, lunch=meal.lunch, dinner=meal.dinner, guest_meal_count=meal.guest_meal_count
    )
    db.add(new_meal)
    db.add(new_meal)
    db.commit()
    return {"message": "Meal added successfully"}

@app.put("/api/groups/{group_id}/meals/{meal_id}")
def update_meal(group_id: str, meal_id: str, payload: MealUpdate, db: Session = Depends(get_db)):
    meal_record = db.query(DBMeal).filter(DBMeal.id == meal_id, DBMeal.group_id == group_id).first()
    if not meal_record:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    if payload.breakfast is not None:
        meal_record.breakfast = payload.breakfast
    if payload.lunch is not None:
        meal_record.lunch = payload.lunch
    if payload.dinner is not None:
        meal_record.dinner = payload.dinner
    if payload.guest_meal_count is not None:
        meal_record.guest_meal_count = payload.guest_meal_count
        
    db.commit()
    return {"message": "Meal updated successfully"}

@app.get("/api/users/{user_id}/cash")
def get_personal_cash(user_id: str, db: Session = Depends(get_db)):
    cash_records = db.query(DBPersonalCash).filter(DBPersonalCash.user_id == user_id).all()
    return [
        {"id": c.id, "name": c.name, "ami_pai": c.ami_pai, "se_pay": c.se_pay}
        for c in cash_records
    ]

@app.post("/api/users/{user_id}/cash")
def add_personal_cash(user_id: str, payload: PersonalCashCreate, db: Session = Depends(get_db)):
    new_cash = DBPersonalCash(
        id=str(uuid.uuid4()), user_id=user_id, name=payload.name,
        ami_pai=payload.ami_pai, se_pay=payload.se_pay
    )
    db.add(new_cash)
    db.commit()
    return {"message": "Cash added successfully"}

@app.put("/api/users/{user_id}/cash/{cash_id}")
def update_personal_cash(user_id: str, cash_id: str, payload: PersonalCashUpdate, db: Session = Depends(get_db)):
    cash_record = db.query(DBPersonalCash).filter(DBPersonalCash.id == cash_id, DBPersonalCash.user_id == user_id).first()
    if not cash_record:
        raise HTTPException(status_code=404, detail="Cash record not found")
    
    if payload.name is not None:
        cash_record.name = payload.name
    if payload.ami_pai is not None:
        cash_record.ami_pai = payload.ami_pai
    if payload.se_pay is not None:
        cash_record.se_pay = payload.se_pay
        
    db.commit()
    return {"message": "Cash updated successfully", "id": cash_record.id, "name": cash_record.name, "ami_pai": cash_record.ami_pai, "se_pay": cash_record.se_pay}

@app.get("/api/users/{user_id}/notifications")
def get_notifications(user_id: str, db: Session = Depends(get_db)):
    notifs = db.query(DBNotification).filter(DBNotification.user_id == user_id).order_by(DBNotification.created_at.desc()).all()
    return [{"id": n.id, "message": n.message, "is_read": n.is_read, "created_at": n.created_at} for n in notifs]

@app.put("/api/notifications/{notif_id}/read")
def read_notification(notif_id: str, db: Session = Depends(get_db)):
    notif = db.query(DBNotification).filter(DBNotification.id == notif_id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"message": "marked read"}

@app.post("/api/groups/{group_id}/remind/{debtor_id}")
def send_reminder(group_id: str, debtor_id: str, db: Session = Depends(get_db)):
    import datetime
    group = db.query(DBGroup).filter(DBGroup.id == group_id).first()
    if not group: raise HTTPException(404, "Group not found")
    
    n = DBNotification(id=str(uuid.uuid4()), user_id=debtor_id, message=f"Reminder: You have pending dues in {group.display_name}. Please settle soon.", created_at=datetime.datetime.now().isoformat())
    db.add(n)
    db.commit()
    return {"message": "Reminder sent"}

@app.post("/api/groups/{group_id}/meal_requests")
def add_meal_request(group_id: str, req: MealRequestCreate, db: Session = Depends(get_db)):
    import datetime
    new_req = DBMealRequest(id=str(uuid.uuid4()), group_id=group_id, user_id=req.user_id, date=req.date, message=req.message, status="pending")
    db.add(new_req)
    
    group = db.query(DBGroup).filter(DBGroup.id == group_id).first()
    user = db.query(DBUser).filter(DBUser.id == req.user_id).first()
    if group and group.manager_id and user:
        n = DBNotification(id=str(uuid.uuid4()), user_id=group.manager_id, message=f"{user.username} requested a meal change for {req.date}: {req.message}", created_at=datetime.datetime.now().isoformat())
        db.add(n)
        
    db.commit()
    return {"message": "Meal request sent"}

@app.get("/api/groups/{group_id}/meal_requests")
def get_meal_requests(group_id: str, db: Session = Depends(get_db)):
    reqs = db.query(DBMealRequest).filter(DBMealRequest.group_id == group_id).all()
    return [{"id": r.id, "user_id": r.user_id, "user_name": r.user.username if r.user else "Unknown", "date": r.date, "status": r.status, "message": r.message} for r in reqs]

@app.put("/api/groups/{group_id}/meal_requests/{req_id}/approve")
def approve_meal_request(group_id: str, req_id: str, payload: MealRequestUpdate, db: Session = Depends(get_db)):
    import datetime
    req = db.query(DBMealRequest).filter(DBMealRequest.id == req_id).first()
    if not req: raise HTTPException(404, "Request not found")
    req.status = payload.status
    db.commit()
    
    n = DBNotification(id=str(uuid.uuid4()), user_id=req.user_id, message=f"Your meal request for {req.date} was {payload.status}.", created_at=datetime.datetime.now().isoformat())
    db.add(n)
    db.commit()
    
    return {"message": f"Request {payload.status}"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
