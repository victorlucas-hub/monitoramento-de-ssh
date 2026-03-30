const statusPanel = document.getElementById('statusPanel');
const statusText = document.getElementById('statusText');
const statusPill = document.getElementById('statusPill');
const headerSummary = document.getElementById('headerSummary');
const hostText = document.getElementById('hostText');
const portText = document.getElementById('portText');
const responseText = document.getElementById('responseText');
const lastCheckedText = document.getElementById('lastCheckedText');
const alertText = document.getElementById('alertText');
const alertBox = document.getElementById('alertBox');
const targetsPabx = document.getElementById('targetsPabx');
const targetsPrinters = document.getElementById('targetsPrinters');
const targetsPhones = document.getElementById('targetsPhones');
const targetForm = document.getElementById('targetForm');
const targetNameInput = document.getElementById('targetNameInput');
const targetHostInput = document.getElementById('targetHostInput');
const targetPortInput = document.getElementById('targetPortInput');
const targetGroupInput = document.getElementById('targetGroupInput');
const targetFormMessage = document.getElementById('targetFormMessage');
const targetSubmitButton = document.getElementById('targetSubmitButton');
const targetCancelButton = document.getElementById('targetCancelButton');
const notificationButton = document.getElementById('notificationButton');
const chartCanvas = document.getElementById('responseChart');
const chartCtx = chartCanvas.getContext('2d');

const MAX_HISTORY = 50;
const history = [];

let lastOfflineSet = '';
let isChecking = false;
let editingTarget = null;
let activeTargetKey = '';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDateTime(value) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleString('pt-BR');
}

function playAlarm() {
  const context = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  gainNode.gain.setValueAtTime(0.0001, context.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.45);
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = chartCanvas.parentElement.clientWidth;
  chartCanvas.width = width * dpr;
  chartCanvas.height = 170 * dpr;
  chartCanvas.style.width = `${width}px`;
  chartCanvas.style.height = '170px';
  chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawChart() {
  const dpr = window.devicePixelRatio || 1;
  const w = chartCanvas.width / dpr;
  const h = chartCanvas.height / dpr;
  const ctx = chartCtx;

  ctx.clearRect(0, 0, w, h);

  if (history.length < 2) {
    ctx.fillStyle = 'rgba(93,132,168,0.35)';
    ctx.font = '13px Archivo, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Aguardando dados do alvo principal...', w / 2, h / 2 + 5);
    return;
  }

  const maxMs = Math.max(...history.map(point => point.ms || 0), 100);
  const slots = history.length;
  const gap = 4;
  const labelW = 38;
  const topPad = 10;
  const bottomPad = 22;
  const barWidth = Math.max(4, Math.floor((w - labelW - gap * (slots + 1)) / slots));
  const totalWidth = slots * (barWidth + gap) - gap;
  const startX = labelW + (w - labelW - totalWidth) / 2;
  const chartHeight = h - topPad - bottomPad;
  const baseY = topPad + chartHeight;
  const points = [];

  // --- grid lines ---
  const gridLines = 4;
  ctx.font = '10px Archivo, system-ui, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= gridLines; i++) {
    const ratio = i / gridLines;
    const gy = topPad + chartHeight * (1 - ratio);
    const label = Math.round(maxMs * ratio);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(labelW, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(93,132,168,0.55)';
    ctx.fillText(label + 'ms', labelW - 4, gy + 3.5);
  }

  // --- bars ---
  history.forEach((point, index) => {
    const x = startX + index * (barWidth + gap);
    const barHeight = point.online ? Math.max(4, (point.ms / maxMs) * chartHeight) : chartHeight * 0.18;
    const y = baseY - barHeight;
    const color = point.online ? '#00d48a' : '#f53a3a';
    const colorFade = point.online ? 'rgba(0,212,138,0.08)' : 'rgba(245,58,58,0.08)';

    const gradient = ctx.createLinearGradient(0, y, 0, baseY);
    gradient.addColorStop(0, point.online ? 'rgba(0,212,138,0.85)' : 'rgba(245,58,58,0.85)');
    gradient.addColorStop(1, colorFade);

    const radius = Math.min(barWidth / 2, 5);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + barWidth - radius, y);
    ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
    ctx.lineTo(x + barWidth, baseY);
    ctx.lineTo(x, baseY);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    // glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.shadowBlur = 0;

    points.push({ x: x + barWidth / 2, y, online: point.online });
  });

  // --- area fill under line ---
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
  }
  ctx.lineTo(points[points.length - 1].x, baseY);
  ctx.lineTo(points[0].x, baseY);
  ctx.closePath();
  const areaGrad = ctx.createLinearGradient(0, topPad, 0, baseY);
  areaGrad.addColorStop(0, 'rgba(255,90,110,0.18)');
  areaGrad.addColorStop(1, 'rgba(255,90,110,0.01)');
  ctx.fillStyle = areaGrad;
  ctx.fill();

  // --- line ---
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
  }
  const lineGrad = ctx.createLinearGradient(points[0].x, 0, points[points.length - 1].x, 0);
  lineGrad.addColorStop(0, 'rgba(255,90,110,0.5)');
  lineGrad.addColorStop(0.5, 'rgba(255,90,110,1)');
  lineGrad.addColorStop(1, 'rgba(255,90,110,0.5)');
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#ff5a6e';
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // --- dots with glow ---
  points.forEach(point => {
    // outer glow ring
    ctx.beginPath();
    ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,90,110,0.18)';
    ctx.fill();
    // inner dot
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff5a6e';
    ctx.strokeStyle = 'rgba(3,7,15,0.9)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#ff5a6e';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
  });

  // --- bottom labels (last 3 points) ---
  ctx.font = '9px Archivo, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(93,132,168,0.5)';
  const step = Math.max(1, Math.floor(points.length / 8));
  points.forEach((point, i) => {
    if (i % step === 0 || i === points.length - 1) {
      ctx.fillText(i + 1, point.x, baseY + 14);
    }
  });
}

function renderTargetsList(targets) {
  const groupMap = {
    PABX: [],
    Impressoras: [],
    Telefones: []
  };

  targets.forEach(target => {
    const groupName = target.group || 'PABX';
    if (groupMap[groupName]) {
      groupMap[groupName].push(target);
    } else {
      groupMap.PABX.push(target);
    }
  });

  const buildGroupHtml = (items) => {
    if (items.length === 0) {
      return '<div class="target-empty">Nenhum IP cadastrado neste topico.</div>';
    }

    return items
    .map(target => {
      const statusClass = target.online ? 'online' : 'offline';
      const statusText = target.online ? 'ONLINE' : 'OFFLINE';
      const response = target.responseTimeMs ? `${target.responseTimeMs} ms` : '--';
      const displayName = escapeHtml(target.name || target.host);
      const displayHost = escapeHtml(target.host || '--');
      const groupName = escapeHtml(target.group || 'PABX');
      const displayPort = Number.isInteger(target.port) ? target.port : '--';
      const targetKey = `${target.host || ''}|${displayPort}|${target.group || 'PABX'}`;
      const rowClass = activeTargetKey === targetKey ? 'is-active' : '';
      return `
        <div class="target-row ${statusClass} ${rowClass}" data-target-key="${encodeURIComponent(targetKey)}">
          <div class="target-main">
            <strong>${displayName}</strong>
            <span>${displayHost}:${displayPort} • ${groupName}</span>
          </div>
          <div class="target-side">
            <span>${response}</span>
            <span class="target-pill">${statusText}</span>
          </div>
          <div class="target-actions">
            <button
              class="target-action target-edit"
              type="button"
              data-host="${encodeURIComponent(target.host || '')}"
              data-port="${Number.isInteger(target.port) ? target.port : ''}"
              data-group="${encodeURIComponent(target.group || 'PABX')}"
              data-name="${encodeURIComponent(target.name || '')}"
            >Editar</button>
            <button
              class="target-action target-delete"
              type="button"
              data-host="${encodeURIComponent(target.host || '')}"
              data-port="${Number.isInteger(target.port) ? target.port : ''}"
              data-group="${encodeURIComponent(target.group || 'PABX')}"
            >Excluir</button>
          </div>
        </div>
      `;
    })
    .join('');
  };

  targetsPabx.innerHTML = buildGroupHtml(groupMap.PABX);
  targetsPrinters.innerHTML = buildGroupHtml(groupMap.Impressoras);
  targetsPhones.innerHTML = buildGroupHtml(groupMap.Telefones);
}

function resetTargetForm() {
  editingTarget = null;
  targetNameInput.value = '';
  targetHostInput.value = '';
  targetPortInput.value = '';
  targetGroupInput.value = 'PABX';
  targetSubmitButton.textContent = 'Adicionar alvo';
  targetCancelButton.hidden = true;
}

async function handleTargetActionClick(event) {
  const editButton = event.target.closest('.target-edit');
  const deleteButton = event.target.closest('.target-delete');
  const clickedRow = event.target.closest('.target-row');

  if (!editButton && !deleteButton && clickedRow) {
    const rowKey = decodeURIComponent(clickedRow.dataset.targetKey || '');
    activeTargetKey = activeTargetKey === rowKey ? '' : rowKey;
    await loadStatus();
    return;
  }

  if (editButton) {
    const host = decodeURIComponent(editButton.dataset.host || '');
    const port = Number(editButton.dataset.port || 22);
    const group = decodeURIComponent(editButton.dataset.group || 'PABX');
    const name = decodeURIComponent(editButton.dataset.name || '');

    editingTarget = {
      host,
      port,
      group
    };

    targetNameInput.value = name;
    targetHostInput.value = host;
    targetPortInput.value = String(port);
    targetGroupInput.value = group;
    targetSubmitButton.textContent = 'Salvar edicao';
    targetCancelButton.hidden = false;
    targetFormMessage.textContent = 'Modo edicao ativo.';
    activeTargetKey = `${host}|${port}|${group}`;
    await loadStatus();
    return;
  }

  if (deleteButton) {
    const host = decodeURIComponent(deleteButton.dataset.host || '');
    const port = Number(deleteButton.dataset.port || 22);
    const group = decodeURIComponent(deleteButton.dataset.group || 'PABX');

    const confirmed = window.confirm(`Excluir ${host}:${port} do topico ${group}?`);
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch('/api/targets', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          host,
          port,
          group
        })
      });

      const responseBody = await response.json();
      if (!response.ok) {
        throw new Error(responseBody.message || 'Falha ao excluir alvo.');
      }

      targetFormMessage.textContent = 'Alvo removido com sucesso.';
      if (editingTarget && editingTarget.host === host && editingTarget.port === port && editingTarget.group === group) {
        resetTargetForm();
      }
      if (activeTargetKey === `${host}|${port}|${group}`) {
        activeTargetKey = '';
      }
      await loadStatus();
    } catch (error) {
      targetFormMessage.textContent = error.message;
    }
  }
}

function notifyIfNeeded(statusPayload) {
  const offlineTargets = statusPayload.targets.filter(target => !target.online);
  const signature = offlineTargets.map(target => `${target.host}:${target.port}`).join('|');

  if (signature && signature !== lastOfflineSet) {
    playAlarm();

    if (Notification.permission === 'granted') {
      new Notification('Alerta de monitoramento SSH', {
        body: `${offlineTargets.length} alvo(s) offline no momento.`,
        tag: 'ssh-monitor-alert'
      });
    }
  }

  lastOfflineSet = signature;
}

function renderStatus(payload) {
  if (!payload.targets || payload.targets.length === 0) {
    statusText.textContent = 'Nenhum alvo configurado';
    statusPill.textContent = 'SEM ALVOS';
    headerSummary.textContent = 'Adicione alvos no arquivo targets.json';
    return;
  }

  const primaryTarget = payload.targets[0];
  const allOnline = payload.offlineTargets === 0;

  hostText.textContent = primaryTarget.host;
  portText.textContent = primaryTarget.port;
  responseText.textContent = primaryTarget.responseTimeMs ? `${primaryTarget.responseTimeMs} ms` : '--';
  lastCheckedText.textContent = formatDateTime(primaryTarget.lastCheckedAt);

  headerSummary.textContent = `${payload.onlineTargets}/${payload.totalTargets} online`;

  history.push({ ms: primaryTarget.responseTimeMs || 0, online: primaryTarget.online });
  if (history.length > MAX_HISTORY) history.shift();
  resizeCanvas();
  drawChart();

  renderTargetsList(payload.targets);

  if (allOnline) {
    statusPanel.classList.remove('offline');
    statusPanel.classList.add('online');
    statusText.textContent = 'Todos os alvos estao online';
    statusPill.textContent = 'ONLINE';
    alertText.textContent = 'Nenhum alerta no momento.';
    alertBox.classList.remove('has-alert');
  } else {
    const offlineTargets = payload.targets
      .filter(target => !target.online)
      .map(target => `${target.host}:${target.port}`)
      .join(', ');

    statusPanel.classList.remove('online');
    statusPanel.classList.add('offline');
    statusText.textContent = `${payload.offlineTargets} alvo(s) offline`;
    statusPill.textContent = 'OFFLINE';
    alertText.textContent = `Fora do ar: ${offlineTargets}`;
    alertBox.classList.add('has-alert');
  }
}

async function loadStatus() {
  if (isChecking) {
    return;
  }

  try {
    isChecking = true;
    const response = await fetch('/api/status');
    const payload = await response.json();
    renderStatus(payload);
    notifyIfNeeded(payload);
  } finally {
    isChecking = false;
  }
}

function startPolling() {
  setInterval(async () => {
    try {
      if (activeTargetKey) {
        return;
      }
      await loadStatus();
    } catch {
      alertText.textContent = 'Conexao com o servidor perdida. Tentando novamente.';
    }
  }, 5000);
}

async function submitTargetForm(event) {
  event.preventDefault();

  const host = targetHostInput.value.trim();
  const name = targetNameInput.value.trim();
  const rawPort = targetPortInput.value.trim();

  if (!host) {
    targetFormMessage.textContent = 'Digite um IP ou host para adicionar.';
    return;
  }

  const payload = {
    host,
    name,
    group: targetGroupInput.value
  };

  if (rawPort) {
    payload.port = Number(rawPort);
  }

  try {
    const isEditing = !!editingTarget;
    const response = await fetch('/api/targets', {
      method: isEditing ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(
        isEditing
          ? {
              ...payload,
              originalHost: editingTarget.host,
              originalPort: editingTarget.port,
              originalGroup: editingTarget.group
            }
          : payload
      )
    });

    const responseBody = await response.json();
    if (!response.ok) {
      throw new Error(responseBody.message || 'Falha ao salvar alvo.');
    }

    targetFormMessage.textContent = isEditing ? 'Alvo atualizado com sucesso.' : 'Alvo adicionado com sucesso.';
    resetTargetForm();
    await loadStatus();
  } catch (error) {
    targetFormMessage.textContent = error.message;
  }
}

notificationButton.addEventListener('click', async () => {
  if (!('Notification' in window)) {
    alertText.textContent = 'Este navegador nao suporta notificacoes.';
    return;
  }

  const permission = await Notification.requestPermission();
  alertText.textContent =
    permission === 'granted'
      ? 'Notificacoes ativadas. Voce sera avisado quando algum alvo cair.'
      : 'Permissao de notificacao nao concedida.';
});

targetForm.addEventListener('submit', submitTargetForm);
targetCancelButton.addEventListener('click', () => {
  resetTargetForm();
  targetFormMessage.textContent = 'Edicao cancelada.';
});
targetsPabx.addEventListener('click', handleTargetActionClick);
targetsPrinters.addEventListener('click', handleTargetActionClick);
targetsPhones.addEventListener('click', handleTargetActionClick);

window.addEventListener('resize', () => {
  resizeCanvas();
  drawChart();
});

resizeCanvas();
drawChart();
loadStatus().catch(() => {
  alertText.textContent = 'Falha ao carregar status inicial.';
});
startPolling();
