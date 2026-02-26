const { WebpayPlus } = require('transbank-sdk');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  // Configuración de CORS para que tu sitio Readdy pueda hablar con Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Solo se permite POST' });
  }

  try {
    const { tour_name, amount, customer_email } = req.body;
    
    // Datos de la orden
    const buyOrder = "O-" + Math.floor(Math.random() * 100000);
    const sessionId = "S-" + Math.floor(Math.random() * 100000);
    // IMPORTANTE: Cambia esto por la URL real de tu página de confirmación más adelante
    const returnUrl = `https://transferdelmar.cl/confirmacion`; 

    // 1. Crear transacción en Transbank
    const tx = new WebpayPlus.Transaction();
    const createResponse = await tx.create(buyOrder, sessionId, amount, returnUrl);

    // 2. Guardar en Supabase
    const { error } = await supabase.from('orders').insert([{
      order_id: buyOrder,
      tour_name: tour_name,
      amount: amount,
      customer_email: customer_email,
      token: createResponse.token,
      status: 'PENDING'
    }]);

    if (error) throw error;

    // 3. Responder con la info para ir a Webpay
    return res.status(200).json({
      url: createResponse.url,
      token: createResponse.token
    });

  } catch (error) {
    console.error("Error en el proceso:", error);
    return res.status(500).json({ error: error.message });
  }
};
