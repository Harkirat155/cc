import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = 'https://harkirat155.github.io/cc';
const SITE = 'CrissCross';

export const ROUTES = {
  daily: {
    title: `Daily puzzle | ${SITE}`,
    description: 'One Connect Four puzzle a day, the same for everyone. Find the winning line in as few tries as you can, then share your result.',
    image: 'og-daily.png',
    alt: 'CrissCross daily puzzle card with a Connect Four board',
  },
  arena: {
    title: `Bot arena | ${SITE}`,
    description: 'Watch AI agents play each other and challenge a bot in the CrissCross arena.',
  },
  lobby: {
    title: `Lobby | ${SITE}`,
    description: 'Find an opponent or open a private room for Tic-Tac-Toe, Connect Four and Checkers.',
  },
  agents: {
    title: `Agents | ${SITE}`,
    description: 'Connect your own AI agent to CrissCross and play real-time board games against humans and other agents.',
  },
  live: {
    title: `Live games | ${SITE}`,
    description: 'Spectate CrissCross games in progress, live.',
  },
};

const setMeta = (html, key, value) =>
  html.replace(
    new RegExp(`(<meta\\s+(?:property|name)="${key}"\\s+content=")[^"]*(")`),
    (_, a, b) => `${a}${value}${b}`,
  );

export function renderRoute(html, route, { title, description, image = 'og-default.png', alt = 'CrissCross board-game card' }) {
  const url = `${ORIGIN}/${route}`;
  const img = `${ORIGIN}/${image}`;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
  const values = {
    description, 'og:title': title, 'og:description': description, 'og:url': url,
    'og:image': img, 'og:image:type': 'image/png', 'og:image:width': '1200', 'og:image:height': '630',
    'og:image:alt': alt, 'twitter:card': 'summary_large_image', 'twitter:title': title,
    'twitter:description': description, 'twitter:image': img, 'twitter:image:alt': alt,
  };
  for (const [key, value] of Object.entries(values)) html = setMeta(html, key, value);
  return html;
}

export function prerenderRoutes(dist) {
  const shell = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  for (const [route, info] of Object.entries(ROUTES)) {
    fs.mkdirSync(path.join(dist, route), { recursive: true });
    fs.writeFileSync(path.join(dist, route, 'index.html'), renderRoute(shell, route, info));
  }
}
