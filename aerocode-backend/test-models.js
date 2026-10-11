import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

async function checkModels() {
  try {
    const response = await openai.models.list();
    console.log('✅ Active models available for your key:');
    response.data.forEach((m) => console.log(` - ${m.id}`));
  } catch (err) {
    console.error('❌ Error fetching models:', err.message);
  }
}

checkModels();