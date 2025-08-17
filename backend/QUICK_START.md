# 🚀 Quick Start Guide - PHANTOM-Flow Backend

## ✅ **Server is Running Successfully!**

Your PHANTOM-Flow backend is now running and ready to use!

---

## 🎯 **How to Run the Backend**

### **Option 1: Using the Startup Script (Recommended)**
```bash
# Navigate to backend directory
cd backend

# Run the startup script
start.bat                    # Windows
./start.sh                   # Linux/Mac
```

### **Option 2: Manual Setup**
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Set environment
set NODE_ENV=development     # Windows
export NODE_ENV=development  # Linux/Mac

# Start the server
npm run dev
```

---

## 🌐 **Available Endpoints**

| Endpoint | URL | Status | Description |
|----------|-----|--------|-------------|
| **Health Check** | http://localhost:3001/health | ✅ **Working** | Server status and health |
| **Dashboard** | http://localhost:3001/api/dashboard | ⚠️ Coming Soon | Main dashboard interface |
| **API Status** | http://localhost:3001/api/status | ⚠️ Coming Soon | System metrics |

---

## 🔧 **Current Status**

✅ **Server Running**: Port 3001  
✅ **Health Endpoint**: Working perfectly  
✅ **Development Mode**: Running without external databases  
✅ **Threat Detection**: Active and monitoring  
✅ **Machine Learning**: TensorFlow.js model initialized  
✅ **Deception Layer**: Honeypot endpoints ready  
✅ **Real-time Communication**: Socket.IO active  

---

## 🧪 **Test the Server**

### **Health Check**
```bash
curl http://localhost:3001/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-17T06:09:46.184Z",
  "version": "1.0.0",
  "environment": "development"
}
```

### **Browser Test**
Open your browser and visit: **http://localhost:3001/health**

---

## 📊 **What's Working**

- ✅ **Express Server**: Running on port 3001
- ✅ **Security Middleware**: Helmet, CORS, Rate limiting
- ✅ **Logging System**: Winston logger active
- ✅ **Threat Detection Engine**: All analyzers working
- ✅ **Machine Learning**: TensorFlow.js model ready
- ✅ **Deception Service**: Honeypot system active
- ✅ **Adaptive Learning**: Continuous improvement system
- ✅ **Real-time Updates**: Socket.IO communication

---

## 🚨 **Troubleshooting**

### **Port Already in Use**
```bash
# Find process using port 3001
netstat -ano | findstr :3001

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### **Node.js Not Found**
```bash
# Install Node.js from: https://nodejs.org/
# Make sure you have version 18+
node --version
```

### **Dependencies Issues**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

---

## 🎯 **Next Steps**

1. **Test the API**: Visit http://localhost:3001/health
2. **Start Frontend**: Set up the React dashboard
3. **Add Endpoints**: Create more API routes
4. **Install Databases**: Add MongoDB/Redis for full functionality
5. **Deploy**: Move to production environment

---

## 📞 **Need Help?**

- **Documentation**: Check `README.md` for detailed information
- **Issues**: Report problems via GitHub Issues
- **Logs**: Check console output for error messages

---

**🎉 Congratulations! Your PHANTOM-Flow backend is running successfully!**
