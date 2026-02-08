# Language-Specific Patterns — OmniDev-V2 Reference

## Python (FastAPI)
```python
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, Field

class ItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    price: float = Field(..., gt=0)

@app.post("/items", response_model=Item, status_code=201)
async def create_item(item: ItemCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_item(db, item)
    except IntegrityError:
        raise HTTPException(409, "Item exists")
```

## TypeScript (React)
```typescript
interface Props {
  items: Item[];
  onSelect: (id: string) => void;
}

export const ItemList: React.FC<Props> = ({ items, onSelect }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const handleSelect = useCallback((id: string) => {
    setSelected(id);
    onSelect(id);
  }, [onSelect]);

  return (
    <ul role="listbox" aria-label="Items">
      {items.map(item => (
        <li key={item.id} onClick={() => handleSelect(item.id)}>{item.name}</li>
      ))}
    </ul>
  );
};
```

## Go (API)
```go
func (s *Server) CreateItem(w http.ResponseWriter, r *http.Request) {
    var item Item
    if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
        http.Error(w, "invalid request", http.StatusBadRequest)
        return
    }
    if err := item.Validate(); err != nil {
        http.Error(w, err.Error(), http.StatusUnprocessableEntity)
        return
    }
    created, err := s.store.Create(r.Context(), &item)
    if err != nil {
        http.Error(w, "internal error", http.StatusInternalServerError)
        return
    }
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(created)
}
```

## Rust (Actix)
```rust
#[post("/items")]
async fn create_item(
    pool: web::Data<PgPool>,
    item: web::Json<CreateItem>,
) -> Result<HttpResponse, AppError> {
    let item = item.into_inner();
    item.validate()?;
    let result = sqlx::query_as!(Item, "INSERT INTO items (name, price) VALUES ($1, $2) RETURNING *", item.name, item.price)
        .fetch_one(pool.get_ref()).await?;
    Ok(HttpResponse::Created().json(result))
}
```

## Debug Commands Quick Reference
```bash
# Python
python -m pdb script.py           # Interactive debugger
python -m pytest -x --tb=short    # Stop on first failure

# Node/TypeScript
node --inspect script.js          # Chrome DevTools debug
DEBUG=* node script.js            # Enable debug logging

# Go
dlv debug ./main.go               # Delve debugger
GODEBUG=gctrace=1 ./app           # GC tracing

# Rust
RUST_BACKTRACE=1 cargo run        # Full backtrace
cargo clippy -- -D warnings       # Lint strict

# Logs (Universal)
journalctl -u service -f          # systemd
kubectl logs -f pod-name          # K8s
docker logs -f container          # Docker
```

## Common Bug Patterns (All Languages)
| Symptom | Cause | Fix |
|---------|-------|-----|
| Works locally, fails prod | Env vars / config | Check env parity |
| Intermittent failure | Race condition / timeout | Locks / retries |
| Memory leak | Unclosed resources | Cleanup in finally/defer/drop |
| Slow query | Missing index, N+1 | EXPLAIN ANALYZE + index |
| CORS error | Missing headers | Configure CORS middleware |
| 401/403 | Token expired / wrong scope | Check auth flow |
| 500 error | Unhandled exception | try/catch + logging |
