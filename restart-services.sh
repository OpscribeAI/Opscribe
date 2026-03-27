#!/bin/bash

# Opscribe Services Restart Script
# Cleans up ports and restarts backend/frontend in proper order

echo "🧹 Cleaning up existing processes..."

# Kill any existing processes
pkill -f uvicorn 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
pkill -f vite 2>/dev/null || true

# Wait a moment for processes to die
sleep 2

# Verify ports are free
echo "🔍 Checking port availability..."
if lsof -i :8001 >/dev/null 2>&1; then
    echo "⚠️  Port 8001 still in use, forcing cleanup..."
    lsof -ti :8001 | xargs kill -9
fi

if lsof -i :5175 >/dev/null 2>&1; then
    echo "⚠️  Port 5175 still in use, forcing cleanup..."
    lsof -ti :5175 | xargs kill -9
fi

echo "✅ Ports cleaned up successfully"

# Start Backend API
echo "🚀 Starting Backend API..."
cd /Users/ak442/Opscribe/apps/api
source venv/bin/activate

# Create and run the minimal API server
python -c "
import os
os.environ['MOCK_DEMO'] = 'true'

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.ingestion_intelligence import router

app = FastAPI(title='Opscribe Ingestion Intelligence API')

# Add CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# Include our router
app.include_router(router)

@app.get('/')
async def root():
    return {'message': 'Opscribe Ingestion Intelligence API', 'status': 'running'}

@app.get('/health')
async def health():
    return {'status': 'ok', 'service': 'opscribe-ingestion-intelligence'}

if __name__ == '__main__':
    import uvicorn
    print('🔥 Backend API starting on http://localhost:8001')
    print('📊 Available endpoints:')
    for route in app.routes:
        if hasattr(route, 'path'):
            methods = getattr(route, 'methods', ['GET'])
            print(f'  {methods} {route.path}')
    uvicorn.run(app, host='0.0.0.0', port=8001)
" &

BACKEND_PID=$!
echo "📡 Backend started with PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Start Frontend
echo "🎨 Starting Frontend..."
cd /Users/ak442/Opscribe/apps/web
npm run dev &

FRONTEND_PID=$!
echo "🌐 Frontend started with PID: $FRONTEND_PID"

# Wait for frontend to start
sleep 5

echo ""
echo "🎉 Services restarted successfully!"
echo ""
echo "📱 Frontend: http://localhost:5175"
echo "🔧 Backend API: http://localhost:8001"
echo "📚 API Docs: http://localhost:8001/docs"
echo ""
echo "🔍 Test commands:"
echo "curl http://localhost:8001/health"
echo "curl \"http://localhost:8001/ingestion-intelligence/report/00000000-0000-0000-0000-000000000000\""
echo ""
echo "🛑 To stop: kill $BACKEND_PID $FRONTEND_PID"
