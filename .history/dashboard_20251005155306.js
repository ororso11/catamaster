* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
    background: #f5f7fa;
    color: #333;
}

header {
    background: white;
    padding: 15px 0;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}

.header-container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 0 30px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1rem;
    font-weight: 600;
    color: #000;
}

.logo-icon {
    width: 35px;
    height: 35px;
    background: #000;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
}

.dashboard-container {
    display: flex;
    max-width: 1600px;
    margin: 0 auto;
    min-height: calc(100vh - 70px);
}

.sidebar {
    width: 250px;
    background: white;
    padding: 30px 0;
    box-shadow: 2px 0 10px rgba(0,0,0,0.05);
}

.sidebar-menu {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 15px 30px;
    cursor: pointer;
    transition: all 0.3s;
    color: #666;
    font-size: 0.95rem;
}

.menu-item:hover {
    background: #f5f7fa;
    color: #000;
}

.menu-item.active {
    background: #000;
    color: white;
    font-weight: 500;
}

.menu-item .icon {
    font-size: 1.3rem;
}

.main-content {
    flex: 1;
    padding: 40px;
}

.content-header {
    margin-bottom: 40px;
}

.content-header h2 {
    font-size: 2rem;
    margin-bottom: 10px;
}

.content-header p {
    color: #666;
    font-size: 1rem;
}

.tab-content {
    display: none;
}

.tab-content.active {
    display: block;
}

.demo-notice {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 25px;
    border-radius: 10px;
    margin-bottom: 30px;
    text-align: center;
}

.demo-notice h3 {
    margin-bottom: 10px;
    font-size: 1.4rem;
}

.demo-notice p {
    opacity: 0.95;
    line-height: 1.6;
}

.cta-button {
    display: inline-block;
    margin-top: 15px;
    padding: 12px 30px;
    background: white;
    color: #667eea;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: transform 0.3s;
}

.cta-button:hover {
    transform: translateY(-2px);
}

.upload-zone {
    background: white;
    border: 3px dashed #ddd;
    border-radius: 15px;
    padding: 80px 40px;
    text-align: center;
    transition: all 0.3s;
    cursor: pointer;
    margin-bottom: 40px;
}

.upload-zone:hover,
.upload-zone.dragover {
    border-color: #007bff;
    background: #f8f9ff;
}

.upload-icon {
    font-size: 5rem;
    margin-bottom: 20px;
}

.upload-zone h3 {
    font-size: 1.5rem;
    margin-bottom: 10px;
}

.upload-zone p {
    color: #666;
    margin-bottom: 30px;
}

.upload-btn {
    padding: 12px 30px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.3s;
}

.upload-btn:hover {
    background: #0056b3;
}

.empty-state {
    text-align: center;
    padding: 80px 20px;
    background: white;
    border-radius: 10px;
}

.empty-icon {
    font-size: 5rem;
    opacity: 0.3;
    margin-bottom: 20px;
}

.empty-state p {
    color: #666;
    font-size: 1.1rem;
}

.preview-tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    border-bottom: 2px solid #ddd;
}

.preview-tab-btn {
    padding: 12px 30px;
    background: #e0e0e0;
    color: #333;
    border: none;
    cursor: pointer;
    font-weight: 600;
    border-radius: 5px 5px 0 0;
    transition: all 0.3s;
}

.preview-tab-btn.active {
    background: #667eea;
    color: white;
}

.preview-frame-container {
    border: 2px solid #ddd;
    border-radius: 10px;
    overflow: hidden;
    background: white;
}

.preview-frame {
    width: 100%;
    height: 700px;
    border: none;
}

.download-buttons {
    display: flex;
    gap: 15px;
    margin-bottom: 30px;
}

.download-btn {
    padding: 12px 25px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    color: white;
    transition: transform 0.3s;
}

.download-btn:hover {
    transform: translateY(-2px);
}

.download-btn.index {
    background: #667eea;
}

.download-btn.admin {
    background: #4CAF50;
}

#processingStatus {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.9);
    color: white;
    padding: 30px 50px;
    border-radius: 10px;
    font-size: 18px;
    z-index: 10000;
}

@media (max-width: 768px) {
    .dashboard-container {
        flex-direction: column;
    }

    .sidebar {
        width: 100%;
        padding: 20px 0;
    }

    .sidebar-menu {
        flex-direction: row;
        overflow-x: auto;
    }

    .menu-item {
        flex-direction: column;
        padding: 15px;
        min-width: 100px;
        text-align: center;
    }

    .main-content {
        padding: 20px;
    }

    .preview-frame {
        height: 500px;
    }

    .download-buttons {
        flex-direction: column;
    }
}