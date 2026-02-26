const { WebpayPlus } = require('transbank-sdk');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  // CORS (Mantenemos los permisos que ya funcionan)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Solo POST' });

  try {
    // 1. Recibimos todos los datos nuevos del requerimiento
    const { tour_name, amount, customer_email, customer_name, customer_phone } = req.body;
    
    const buyOrder = "TDM-" + Math.floor(Math.random() * 100000);
    const sessionId = "SES-" + Math.floor(Math.random() * 100000);
    const returnUrl = `https://transferdelmar.cl/confirmacion`; 

    // 2. Calculamos expiración (Ahora + 30 minutos)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60000); // 30 min en milisegundos

    // 3. Crear transacción en Transbank
    const tx = new WebpayPlus.Transaction();
    const createResponse = await tx.create(buyOrder, sessionId, amount, returnUrl);

    // 4. Guardar orden completa en Supabase
    const { error } = await supabase.from('orders').insert([{
      order_id: buyOrder,
      tour_name: tour_name,
      amount: amount,
      currency: 'CLP',
      customer_email: customer_email,
      customer_name: customer_name,      // Nuevo dato
      customer_phone: customer_phone,    // Nuevo dato
      token: createResponse.token,
      status: 'PENDING',
      expires_at: expiresAt.toISOString() // Fecha calculada
    }]);

    if (error) throw error;

    return res.status(200).json({
      url: createResponse.url,
      token: createResponse.token
    });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: error.message });
  }
};
