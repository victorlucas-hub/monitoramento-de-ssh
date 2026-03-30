import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TARGETS_FILE = path.join(__dirname, 'targets.json');
const CONNECT_TIMEOUT_MS = 3000;
const PORT = process.env.PORT || 3000;

// --- Utility functions ---

function loadTargets() {
  try {
    if (!fs.existsSync(TARGETS_FILE)) {
      return [
        { name: 'Alvo Principal', host: '10.119.8.1', port: 22, group: 'PABX' }
      ];
    }
    const data = fs.readFileSync(TARGETS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    console.error('Error reading targets.json:', e);
    return [
      { name: 'Alvo Principal', host: '10.119.8.1', port: 22, group: 'PABX' }
    ];
  }
}

function saveTargets(targets) {
  try {
    fs.writeFileSync(TARGETS_FILE, JSON.stringify(targets, null, 2));
  } catch (e) {
    console.error('Error writing targets.json:', e);
  }
}

function testConnection(host, port, timeoutMs = CONNECT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({
        online: false,
        responseTimeMs: 0,
        failureReason: 'Timeout',
        group: null
      });
    }, timeoutMs);

    const startTime = Date.now();

    socket.on('connect', () => {
      clearTimeout(timeout);
      const responseTime = Date.now() - startTime;
      socket.destroy();
      resolve({
        online: true,
        responseTimeMs: responseTime,
        failureReason: null,
        group: null
      });
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      socket.destroy();
      resolve({
        online: false,
        responseTimeMs: 0,
        failureReason: err.code || 'Error',
        group: null
      });
    });

    socket.connect(port || 22, host);
  });
}

async function getAllTargetsStatus() {
  const targets = loadTargets();
  const results = await Promise.all(
    targets.map(async (target) => {
      const test = await testConnection(target.host, target.port || 22);
      return {
        ...target,
        online: test.online,
        responseTimeMs: test.responseTimeMs,
        failureReason: test.failureReason
      };
    })
  );

  const onlineCount = results.filter(t => t.online).length;
  const offlineCount = results.filter(t => !t.online).length;

  return {
    targets: results,
    onlineCount,
    offlineCount,
    totalCount: results.length,
    timestamp: new Date().toISOString()
  };
}

// --- Routes ---

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', async (req, res) => {
  try {
    const status = await getAllTargetsStatus();
    res.json(status);
  } catch (error) {
    console.error('Error in /api/status:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/targets', (req, res) => {
  try {
    const targets = loadTargets();
    res.json(targets);
  } catch (error) {
    console.error('Error in /api/targets:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/targets', (req, res) => {
  try {
    const { name, host, port, group } = req.body;

    if (!host) {
      return res.status(400).json({ error: 'Host is required' });
    }

    const targets = loadTargets();
    const normalizedPort = port ? Number(port) : 22;
    const normalizedGroup = group || 'PABX';

    // Check for duplicates
    const duplicate = targets.find(
      t => t.host === host && (t.port || 22) === normalizedPort && t.group === normalizedGroup
    );

    if (duplicate) {
      return res.status(400).json({ error: 'Target already exists' });
    }

    targets.push({
      name: name || host,
      host,
      port: port ? normalizedPort : undefined,
      group: normalizedGroup
    });

    saveTargets(targets);
    res.json({ success: true, targets });
  } catch (error) {
    console.error('Error in POST /api/targets:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/targets', (req, res) => {
  try {
    const { originalHost, originalPort, originalGroup, name, host, port, group } = req.body;

    if (!host) {
      return res.status(400).json({ error: 'Host is required' });
    }

    let targets = loadTargets();
    const originalNormalizedPort = originalPort ? Number(originalPort) : 22;

    const index = targets.findIndex(
      t => t.host === originalHost && 
           (t.port || 22) === originalNormalizedPort && 
           t.group === (originalGroup || 'PABX')
    );

    if (index === -1) {
      return res.status(404).json({ error: 'Target not found' });
    }

    const normalizedPort = port ? Number(port) : undefined;
    const normalizedGroup = group || 'PABX';

    targets[index] = {
      name: name || host,
      host,
      port: normalizedPort,
      group: normalizedGroup
    };

    saveTargets(targets);
    res.json({ success: true, targets });
  } catch (error) {
    console.error('Error in PUT /api/targets:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/targets', (req, res) => {
  try {
    const { host, port, group } = req.body;

    let targets = loadTargets();
    const normalizedPort = port ? Number(port) : 22;
    const normalizedGroup = group || 'PABX';

    targets = targets.filter(
      t => !(t.host === host && (t.port || 22) === normalizedPort && t.group === normalizedGroup)
    );

    saveTargets(targets);
    res.json({ success: true, targets });
  } catch (error) {
    console.error('Error in DELETE /api/targets:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Server start ---

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nDashboard local:  http://localhost:${PORT}`);
  console.log(`Dashboard na rede: http://127.0.0.1:${PORT}\n`);
  console.log('Targets carregados de targets.json');
  console.log('Pressione Ctrl+C para encerrar.\n');
});
