const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:5001/api/doctor-ai', {
      prompt: "Hello"
    });
    console.log("Success:", res.data);
  } catch (err) {
    console.error("Failed:", err.response?.status, err.response?.data || err.message);
  }
}

test();
