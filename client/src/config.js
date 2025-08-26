const config = {
  API_URL: process.env.NODE_ENV === 'production' 
    ? 'https://skyrden-portal-production.up.railway.app/api'
    : 'http://localhost:5001/api'
};

export default config;