const config = {
  API_URL: process.env.NODE_ENV === 'production' 
    ? 'https://skyrden-portal-production.up.railway.app'
    : 'http://localhost:5001'
};

export default config;