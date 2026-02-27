const { WebpayPlus, Options, Environment } = require('transbank-sdk');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  // Configuración de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Solo POST' });

  try {
    const { tour_name, amount, customer_email, customer_name, customer_phone } = req.body;
    
    // 1. Validar que las variables existan
    if (!process.env.TBE_COMMERCE_CODE || !process.env.TBE_API_KEY) {
        throw new Error("Faltan variables de entorno de Transbank en Vercel.");
    }

    const buyOrder = "TDM-" + Math.floor(Math.random() * 100000);
    const sessionId = "SES-" + Math.floor(Math.random() * 100000);
    const returnUrl = `https://transferdelmar.cl/confirmacion`; 

    // 2. Iniciar Webpay con manejo manual de opciones
    const tx = new WebpayPlus.Transaction(new Options(
      process.env.TBE_COMMERCE_CODE, 
      process.env.TBE_API_KEY, 
      process.env.TBE_ENVIRONMENT === 'PRODUCTION' ? Environment.Production : Environment.Integration
    ));

    const createResponse = await tx.create(buyOrder, sessionId, amount, returnUrl);

    // 3. Intento de guardado en Supabase (No bloqueante)
    try {
      await supabase.from('orders').insert([{
        order_id: buyOrder,
        tour_name: tour_name,
        amount: amount,
        customer_email: customer_email,
        customer_name: customer_name,
        customer_phone: customer_phone,
        token: createResponse.token,
        status: 'PENDING',
        expires_at: new Date(Date.now() + 30 * 60000).toISOString()
      }]);
    } catch (dbErr) {
      console.error("Fallo Supabase:", dbErr.message);
    }

    // 4. Respuesta al Front
    return res.status(200).json({
      url: createResponse.url,
      token: createResponse.token
    });

  } catch (error) {
    // ESTO ES LO QUE VEREMOS EN LOS LOGS DE VERCEL
    console.error("ERROR DETECTADO:", error.message);
    return res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
};
