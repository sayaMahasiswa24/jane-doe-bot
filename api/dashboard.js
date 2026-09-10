const { Redis } = require("@upstash/redis");
require('dotenv').config();

module.exports = async (req, res) => {
    // Basic Security Check
    const expectedPassword = process.env.DASHBOARD_PASSWORD;
    if (expectedPassword && req.query.pw !== expectedPassword) {
        return res.status(401).send(`
            <html lang="en" class="dark">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Unauthorized</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <script>
                    tailwind.config = { darkMode: 'class' }
                </script>
            </head>
            <body class="bg-slate-900 flex items-center justify-center h-screen text-white font-sans">
                <div class="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 backdrop-blur-md shadow-2xl text-center">
                    <h1 class="text-3xl font-bold text-red-400 mb-4">Akses Ditolak</h1>
                    <p class="text-slate-300">Anda memerlukan password untuk mengakses dashboard ini.</p>
                </div>
            </body>
            </html>
        `);
    }

    try {
        if (!process.env.UPSTASH_REDIS_REST_URL) {
            throw new Error("Upstash is not configured.");
        }

        const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });

        // Get recent logs from Redis
        const logsRaw = await redis.lrange("bot_errors", 0, -1);
        const logs = logsRaw.map(log => {
            try {
                return typeof log === 'string' ? JSON.parse(log) : log;
            } catch (e) {
                return { timestamp: '-', context: 'Unknown', message: 'Parse error', detail: String(log) };
            }
        });

        // Build HTML
        const html = `
        <!DOCTYPE html>
        <html lang="en" class="dark">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Jane Doe Bot - Error Dashboard</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
            <script>
                tailwind.config = {
                    darkMode: 'class',
                    theme: {
                        extend: {
                            fontFamily: { sans: ['Inter', 'sans-serif'] },
                            colors: {
                                brand: {
                                    400: '#818cf8',
                                    500: '#6366f1',
                                    600: '#4f46e5',
                                }
                            }
                        }
                    }
                }
            </script>
            <style>
                body {
                    background-color: #0f172a;
                    background-image: 
                        radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), 
                        radial-gradient(at 50% 0%, hsla(225,39%,30%,0.2) 0, transparent 50%), 
                        radial-gradient(at 100% 0%, hsla(339,49%,30%,0.2) 0, transparent 50%);
                    background-attachment: fixed;
                }
                .glass-panel {
                    background: rgba(30, 41, 59, 0.4);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                /* Custom Scrollbar */
                ::-webkit-scrollbar { width: 8px; height: 8px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
            </style>
        </head>
        <body class="text-slate-200 antialiased min-h-screen p-4 md:p-8">
            
            <div class="max-w-6xl mx-auto">
                <header class="flex items-center justify-between mb-8">
                    <div>
                        <h1 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-purple-400">Jane Doe Dashboard</h1>
                        <p class="text-slate-400 mt-1">Live Error Monitoring & Analytics</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse"></div>
                        <span class="text-sm font-medium text-slate-300">System Online</span>
                    </div>
                </header>

                <div class="glass-panel rounded-2xl p-6 shadow-2xl mb-8 border border-slate-700/50">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-xl font-semibold flex items-center gap-2">
                            <svg class="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            Recent Errors
                        </h2>
                        <span class="bg-brand-500/20 text-brand-400 py-1 px-3 rounded-full text-xs font-medium border border-brand-500/30">
                            ${logs.length} / 50 Logs
                        </span>
                    </div>

                    ${logs.length === 0 ? `
                        <div class="text-center py-12">
                            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4 border border-slate-700">
                                <svg class="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            <h3 class="text-lg font-medium text-slate-300">All Clear!</h3>
                            <p class="text-slate-500 mt-1">Tidak ada error yang tercatat. Bot Jane Doe berjalan sempurna.</p>
                        </div>
                    ` : `
                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse">
                                <thead>
                                    <tr class="border-b border-slate-700/50 text-slate-400 text-sm uppercase tracking-wider">
                                        <th class="pb-3 pt-2 px-4 font-medium">Timestamp</th>
                                        <th class="pb-3 pt-2 px-4 font-medium">Context</th>
                                        <th class="pb-3 pt-2 px-4 font-medium">Message</th>
                                        <th class="pb-3 pt-2 px-4 font-medium">Details</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-700/30">
                                    ${logs.map(log => `
                                        <tr class="hover:bg-white/5 transition-colors duration-200 group">
                                            <td class="py-4 px-4 text-sm text-slate-400 whitespace-nowrap">
                                                ${new Date(log.timestamp).toLocaleString('id-ID')}
                                            </td>
                                            <td class="py-4 px-4">
                                                <span class="bg-slate-800 text-slate-300 py-1 px-2 rounded text-xs font-medium border border-slate-700/50">
                                                    ${log.context}
                                                </span>
                                            </td>
                                            <td class="py-4 px-4 text-sm font-medium text-slate-200">
                                                ${log.message}
                                            </td>
                                            <td class="py-4 px-4 text-xs font-mono text-slate-400 break-words max-w-xs md:max-w-md bg-slate-900/50 p-2 rounded m-2 block overflow-x-auto border border-slate-800">
                                                ${log.detail || '-'}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
            
        </body>
        </html>
        `;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);

    } catch (error) {
        console.error('Dashboard Error:', error);
        return res.status(500).send('Internal Server Error fetching dashboard logs.');
    }
};
