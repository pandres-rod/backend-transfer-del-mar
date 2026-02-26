const { WebpayPlus } = require('transbank-sdk');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  // --- AGREGAR ESTO PARA EVITAR EL ERROR DE CONEXIÓN ---
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Permite peticiones desde cualquier lugar
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  // ----------------------------------------------------

  if (req.method !== 'POST') return res.status(405).send('Metodo no permitido');

  // 1. Recibimos los datos que vienen de la card de Readdy.ai
  const { tour_name, customer_email, amount } = req.body;
  const buyOrder = "O-" + Math.floor(Math.random() * 10000); // Generamos un ID de orden al azar
  const sessionId = "S-" + Math.floor(Math.random() * 10000);
  const returnUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/confirmacion`;

  try {
    // 2. Le pedimos a Transbank que inicie la transacción
    const createResponse = await (new WebpayPlus.Transaction()).create(
      buyOrder, 
      sessionId, 
      amount, 
      returnUrl
    );

    // 3. Guardamos la intención de compra en Supabase
    await supabase.from('orders').insert([{
      order_id: buyOrder,
      tour_name: tour_name,
      amount: amount,
      customer_email: customer_email,
      token: createResponse.token,
      status: 'PENDING'
    }]);

    // 4. Respondemos a Readdy.ai con la URL donde debe enviar al usuario
    res.status(200).json({
      url: createResponse.url,
      token: createResponse.token
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
