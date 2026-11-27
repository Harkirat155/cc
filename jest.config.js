// Lets Jest load modules that read Vite's import.meta.env (tests set process.env instead).
const viteMetaEnv = ({ types: t }) => ({
  visitor: {
    MetaProperty(path) {
      path.replaceWith(t.objectExpression([t.objectProperty(t.identifier('env'), t.memberExpression(t.identifier('process'), t.identifier('env')))]));
    },
  },
});

export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['./jest.setup.js'],
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['@babel/preset-env', '@babel/preset-react'], plugins: [viteMetaEnv] }],
  },
  transformIgnorePatterns: ['/node_modules/(?!lucide-react/)'],
  // Default ignore is only node_modules. Setting this replaces it, so keep both.
  // worker/ tests run under Vitest (vitest-pool-workers), not Jest.
  testPathIgnorePatterns: ['/node_modules/', '/worker/'],
};