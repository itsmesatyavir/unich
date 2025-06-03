import blessed from 'blessed';
import axios from 'axios';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import cfonts from 'cfonts';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class UnichMiner {
  constructor(token, proxy = null, id) {
    this.token = token;
    this.proxy = proxy;
    this.id = id;
    this.userInfo = {};
    this.status = 'Idle';
    this.nextMining = '-';
    this.totalPoints = 0;
    this.countdownInterval = null;
    this.uiScreen = null;
    this.accountPane = null;
    this.logPane = null;
    this.isDisplayed = false;
    this.logs = [];
    this.email = 'N/A';
    this.ipAddress = 'N/A';
  }

  async start() {
    await this.fetchIpAddress();
    await this.fetchUserInfo();
    this.startCountdown();
  }

  async fetchIpAddress() {
    try {
      let config = {
        headers: {
          'user-agent': this.getRandomUserAgent(),
          'accept': 'application/json, text/plain, */*',
        },
      };
      if (this.proxy) {
        const agent = this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url);
        config = { ...config, httpsAgent: agent, httpAgent: agent };
        this.addLog(chalk.yellow(`Using proxy: ${this.proxy.url} (${this.proxy.type})`));
      } else {
        this.addLog(chalk.yellow('No proxy configured'));
      }
      const response = await axios.get('https://api.ipify.org?format=json', config);
      this.ipAddress = response.data.ip;
    } catch (error) {
      this.ipAddress = 'Unknown';
      this.addLog(chalk.red(`Failed to fetch IP: ${error.message}`));
    }
  }

  async fetchUserInfo() {
    try {
      const response = await axios.get('https://api.unich.com/airdrop/user/v1/info/my-info', {
        headers: {
          'authorization': `Bearer ${this.token}`,
          'user-agent': this.getRandomUserAgent(),
          'accept': 'application/json, text/plain, */*',
          'accept-encoding': 'gzip, deflate, br, zstd',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
          'cache-control': 'no-cache',
          'origin': 'https://unich.com',
          'pragma': 'no-cache',
          'priority': 'u=1, i',
          'referer': 'https://unich.com/',
          'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Opera";v="119"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
        },
        ...(this.proxy ? {
          httpsAgent: this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url),
          httpAgent: this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url),
        } : {}),
      });
      const data = response.data.data;
      this.userInfo = data;
      this.email = data.email;
      this.totalPoints = data.mUn || 0;
      this.addLog(chalk.green('User info fetched successfully'));
      if (data.mining.todayMining.started) {
        this.status = 'Mining Started';
        this.nextMining = this.formatTime(data.mining.todayMining.remainingTimeInMillis);
        this.addLog(chalk.green('Mining is running'));
      } else {
        this.status = 'Idle';
        this.nextMining = '-';
        this.addLog(chalk.yellow('Mining is not running'));
        await this.startMining();
      }
    } catch (error) {
      this.addLog(chalk.red(`Failed to fetch user info: ${error.message}`));
      if (error.response && error.response.status === 401) {
        this.addLog(chalk.red('Invalid token: Unauthorized (401)'));
        this.status = 'Error';
      }
    }
    this.refreshDisplay();
  }

  async startMining() {
    try {
      await axios.post('https://api.unich.com/airdrop/user/v1/mining/start', {}, {
        headers: {
          'authorization': `Bearer ${this.token}`,
          'user-agent': this.getRandomUserAgent(),
          'accept': 'application/json, text/plain, */*',
          'accept-encoding': 'gzip, deflate, br, zstd',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
          'cache-control': 'no-cache',
          'origin': 'https://unich.com',
          'pragma': 'no-cache',
          'priority': 'u=1, i',
          'referer': 'https://unich.com/',
          'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Opera";v="119"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
        },
        ...(this.proxy ? {
          httpsAgent: this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url),
          httpAgent: this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url),
        } : {}),
      });
      this.addLog(chalk.green('Mining started successfully'));
      await this.updateUserInfo();
    } catch (error) {
      this.addLog(chalk.red(`Failed to start mining: ${error.message}`));
      if (error.response && error.response.status === 401) {
        this.addLog(chalk.red('Invalid token: Unauthorized (401)'));
        this.status = 'Error';
      }
      this.refreshDisplay();
    }
  }

  async updateUserInfo() {
    try {
      const response = await axios.get('https://api.unich.com/airdrop/user/v1/info/my-info', {
        headers: {
          'authorization': `Bearer ${this.token}`,
          'user-agent': this.getRandomUserAgent(),
          'accept': 'application/json, text/plain, */*',
          'accept-encoding': 'gzip, deflate, br, zstd',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
          'cache-control': 'no-cache',
          'origin': 'https://unich.com',
          'pragma': 'no-cache',
          'priority': 'u=1, i',
          'referer': 'https://unich.com/',
          'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Opera";v="119"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
        },
        ...(this.proxy ? {
          httpsAgent: this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url),
          httpAgent: this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url),
        } : {}),
      });
      const data = response.data.data;
      this.userInfo = data;
      this.email = data.email;
      this.totalPoints = data.mUn || 0;
      if (data.mining.todayMining.started) {
        this.status = 'Mining Started';
        this.nextMining = this.formatTime(data.mining.todayMining.remainingTimeInMillis);
        this.addLog(chalk.green('Mining is running'));
      } else {
        this.status = 'Idle';
        this.nextMining = '-';
        this.addLog(chalk.yellow('Mining is not running'));
      }
      this.refreshDisplay();
    } catch (error) {
      this.addLog(chalk.red(`Failed to update user info: ${error.message}`));
      if (error.response && error.response.status === 401) {
        this.addLog(chalk.red('Invalid token: Unauthorized (401)'));
        this.status = 'Error';
      }
      this.refreshDisplay();
    }
  }

  startCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.countdownInterval = setInterval(() => {
      if (this.userInfo.mining && this.userInfo.mining.todayMining.started) {
        const remaining = this.userInfo.mining.todayMining.remainingTimeInMillis - 1000;
        if (remaining <= 0) {
          this.userInfo.mining.todayMining.remainingTimeInMillis = 0;
          this.nextMining = '-';
          this.status = 'Idle';
          this.addLog(chalk.yellow('Mining is not running'));
          setTimeout(() => this.fetchUserInfo(), 10000);
        } else {
          this.userInfo.mining.todayMining.remainingTimeInMillis = remaining;
          this.nextMining = this.formatTime(remaining);
        }
        this.refreshDisplay();
      }
    }, 1000);
  }

  formatTime(millis) {
    const seconds = Math.floor(millis / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  }

  getRandomUserAgent() {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 OPR/119.0.0.0 (Edition cdf)',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  addLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] [Account ${this.id}] ${message.replace(/\{[^}]+\}/g, '')}`;
    this.logs.push(logMessage);
    if (this.logs.length > 100) this.logs.shift();
    if (this.logPane && this.isDisplayed) {
      this.logPane.setContent(this.logs.join('\n'));
      this.logPane.setScrollPerc(100);
      this.uiScreen.render();
    }
  }

  refreshDisplay() {
    if (!this.isDisplayed || !this.accountPane || !this.logPane) return;
    const statusColor = this.status === 'Mining Started' ? 'green' : this.status === 'Error' ? 'red' : 'yellow';
    const info = `
 Email Address : {magenta-fg}${this.email}{/magenta-fg}
 Total Points  : {green-fg}${this.totalPoints}{/green-fg}
 Status        : {${statusColor}-fg}${this.status}{/}
 Next Mining   : {yellow-fg}${this.nextMining}{/yellow-fg}
 IP Address    : {cyan-fg}${this.ipAddress}{/cyan-fg}
 Proxy         : {cyan-fg}${this.proxy ? `${this.proxy.url} (${this.proxy.type})` : 'None'}{/cyan-fg}
    `;
    this.accountPane.setContent(info);
    this.logPane.setContent(this.logs.join('\n'));
    this.logPane.setScrollPerc(100);
    this.uiScreen.render();
  }

  static async loadTokens() {
    try {
      const filePath = path.join(__dirname, 'token.txt');
      const data = await fs.readFile(filePath, 'utf8');
      const tokens = data.split('\n')
        .map(line => line.trim())
        .filter(line => line !== '')
        .map((token, index) => ({ id: index + 1, token }));
      if (!tokens.length) {
        console.error('[ERROR] token.txt is empty');
        return [];
      }
      return tokens;
    } catch (error) {
      console.error(`[ERROR] Failed to load token.txt: ${error.message}`);
      return [];
    }
  }

  static async loadProxies() {
    const proxies = [];
    try {
      const filePath = path.join(__dirname, 'proxy.txt');
      const data = await fs.readFile(filePath, 'utf8');
      const lines = data.split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');
      for (const line of lines) {
        const proxyRegex = /^(socks5|http|https):\/\/(?:([^:@]+):([^@]+)@)?([^:]+):(\d+)$/i;
        const match = line.match(proxyRegex);
        if (!match) {
          proxies.push({ error: `Invalid proxy format: ${line}. Expected 'socks5://[user:pass@]host:port' or 'http(s)://[user:pass@]host:port', skipping.` });
          continue;
        }
        const [, scheme, username, password, host, port] = match;
        const type = scheme.toLowerCase() === 'socks5' ? 'socks5' : 'http';
        const auth = username && password ? `${username}:${password}@` : '';
        const url = `${scheme}://${auth}${host}:${port}`;
        proxies.push({ type, url });
      }
      if (!proxies.filter(p => !p.error).length) {
        proxies.push({ error: 'No valid proxies found in proxy.txt. Running without proxy.' });
      }
      return proxies;
    } catch (error) {
      proxies.push({ error: `Failed to read proxy.txt: ${error.message}. Running without proxy.` });
      return proxies;
    }
  }
}

async function main() {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Unich Auto Mining',
  });

  const headerPane = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 7,
    tags: true,
    align: 'left',
  });
  screen.append(headerPane);

  function renderBanner() {
    const threshold = 80;
    const margin = Math.max(screen.width - 80, 0);
    let art = "";
    if (screen.width >= threshold) {
      art = cfonts.render('FOREST ARMY', {
        font: 'block',
        align: 'center',
        colors: ['cyan', 'magenta'],
        background: 'transparent',
        letterSpacing: 1,
        lineHeight: 1,
        space: true,
        maxLength: screen.width - margin,
      }).string;
    } else {
      art = cfonts.render('FOREST ARMY', {
        font: 'tiny',
        align: 'center',
        colors: ['cyan', 'magenta'],
        background: 'transparent',
        letterSpacing: 1,
        lineHeight: 1,
        space: true,
        maxLength: screen.width - margin,
      }).string;
    }
    headerPane.setContent(art + '\n');
    headerPane.height = Math.min(8, art.split('\n').length + 2);
  }
  renderBanner();

  const channelPane2 = blessed.box({
    top: '28%',
    left: 2,
    width: '100%',
    height: 2,
    tags: false,
    align: 'center',
  });
  channelPane2.setContent('✪ BOT UNICH AUTO MINING ✪');
  screen.append(channelPane2);

  const infoPane = blessed.box({
    bottom: 0,
    left: 'center',
    width: '100%',
    height: 2,
    tags: true,
    align: 'center',
  });
  screen.append(infoPane);

  const dashTop = headerPane.height + channelPane2.height;
  const accountPane = blessed.box({
    top: dashTop,
    left: 0,
    width: '50%',
    height: '60%',
    border: { type: 'line' },
    label: ' User Info ',
    tags: true,
    style: { border: { fg: 'cyan' }, fg: 'white', bg: 'default' },
  });
  screen.append(accountPane);

  const logPane = blessed.log({
    top: dashTop,
    left: '50%',
    width: '50%',
    height: '60%',
    border: { type: 'line' },
    label: ' System Logs ',
    tags: true,
    style: { border: { fg: 'magenta' }, fg: 'white', bg: 'default' },
    scrollable: true,
    scrollbar: { bg: 'blue', fg: 'white' },
    alwaysScroll: true,
    mouse: true,
    keys: true,
  });
  screen.append(logPane);

  logPane.on('keypress', (ch, key) => {
    if (key.name === 'up') {
      logPane.scroll(-1);
      screen.render();
    } else if (key.name === 'down') {
      logPane.scroll(1);
      screen.render();
    } else if (key.name === 'pageup') {
      logPane.scroll(-10);
      screen.render();
    } else if (key.name === 'pagedown') {
      logPane.scroll(10);
      screen.render();
    }
  });

  logPane.on('mouse', (data) => {
    if (data.action === 'wheelup') {
      logPane.scroll(-2);
      screen.render();
    } else if (data.action === 'wheeldown') {
      logPane.scroll(2);
      screen.render();
    }
  });

  let tokens = await UnichMiner.loadTokens();
  let proxies = await UnichMiner.loadProxies();
  let activeIndex = 0;
  let miners = [];

  function updateMiners() {
    miners.forEach(miner => {
      if (miner.countdownInterval) {
        clearInterval(miner.countdownInterval);
      }
    });
    miners = tokens.map((token, idx) => {
      const proxyEntry = proxies[idx % proxies.length] || null;
      const proxy = proxyEntry && !proxyEntry.error ? { ...proxyEntry } : null;
      const miner = new UnichMiner(token.token, proxy, token.id);
      miner.uiScreen = screen;
      miner.accountPane = accountPane;
      miner.logPane = logPane;
      if (proxyEntry && proxyEntry.error) {
        miner.addLog(chalk.yellow(proxyEntry.error));
      }
      return miner;
    });

    if (miners.length > 0) {
      miners[activeIndex].isDisplayed = true;
      miners[activeIndex].addLog(chalk.green('Miner initialized successfully'));
      miners[activeIndex].refreshDisplay();
      miners.forEach(miner => miner.start());
    } else {
      logPane.setContent('No valid tokens found in token.txt.\nPress \'q\' or Ctrl+C to exit.');
      accountPane.setContent('');
      screen.render();
    }
  }

  updateMiners();

  if (!miners.length) {
    screen.key(['escape', 'q', 'C-c'], () => {
      screen.destroy();
      process.exit(0);
    });
    screen.render();
    return;
  }

  infoPane.setContent(`Current Account: ${miners.length > 0 ? activeIndex + 1 : 0}/${miners.length} | Use Left/Right arrow keys to switch accounts.`);

  screen.key(['escape', 'q', 'C-c'], () => {
    miners.forEach(miner => {
      if (miner.countdownInterval) {
        clearInterval(miner.countdownInterval);
      }
      miner.addLog(chalk.yellow('Miner stopped'));
    });
    screen.destroy();
    process.exit(0);
  });

  screen.key(['right'], () => {
    if (miners.length === 0) return;
    miners[activeIndex].isDisplayed = false;
    activeIndex = (activeIndex + 1) % miners.length;
    miners[activeIndex].isDisplayed = true;
    miners[activeIndex].refreshDisplay();
    infoPane.setContent(`Current Account: ${activeIndex + 1}/${miners.length} | Use Left/Right arrow keys to switch accounts.`);
    screen.render();
  });

  screen.key(['left'], () => {
    if (miners.length === 0) return;
    miners[activeIndex].isDisplayed = false;
    activeIndex = (activeIndex - 1 + miners.length) % miners.length;
    miners[activeIndex].isDisplayed = true;
    miners[activeIndex].refreshDisplay();
    infoPane.setContent(`Current Account: ${activeIndex + 1}/${miners.length} | Use Left/Right arrow keys to switch accounts.`);
    screen.render();
  });

  screen.key(['tab'], () => {
    logPane.focus();
    screen.render();
  });

  screen.on('resize', () => {
    renderBanner();
    headerPane.width = '100%';
    channelPane2.top = headerPane.height;
    accountPane.top = dashTop;
    logPane.top = dashTop;
    screen.render();
  });

  screen.render();
}

main().catch(error => {
  console.error(`[ERROR] Failed to start: ${error.message}`);
  const screen = blessed.screen({ smartCSR: true, title: 'Unich Miner' });
  const logPane = blessed.box({
    top: 'center',
    left: 'center',
    width: '80%',
    height: '100%',
    border: { type: 'line' },
    label: ' System Logs ',
    content: `Failed to start: ${error.message}\nPlease fix the issue and restart.\nPress 'q' or Ctrl+C to exit`,
    style: { border: { fg: 'red' }, fg: 'blue', bg: 'default' },
  });
  screen.append(logPane);
  screen.key(['escape', 'q', 'C-c'], () => {
    screen.destroy();
    process.exit(0);
  });
  screen.render();
});
