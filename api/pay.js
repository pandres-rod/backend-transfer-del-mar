const { WebpayPlus, Options, Environment } = require('transbank-sdk');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  // 1. Configuración de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Solo POST' });

  try {
    const { tour_name, amount, customer_email, customer_name, customer_phone } = req.body;
    
    // 2. Limpieza y Normalización de Credenciales (Evita el error 401)
    const commerceCode = String(process.env.TBE_COMMERCE_CODE || '').trim();
    const apiKey = String(process.env.TBE_API_KEY || '').trim();
    
    // Verificación de Ambiente
    const isProduction = process.env.TBE_ENVIRONMENT === 'PRODUCTION';
    const envConfig = isProduction ? Environment.Production : Environment.Integration;

    // Log de diagnóstico en Vercel
    console.log(`Conectando a Webpay - Comercio: ${commerceCode} - Modo: ${isProduction ? 'PROD' : 'INT'}`);

    if (!commerceCode || !apiKey) {
        throw new Error("Credenciales incompletas en variables de entorno.");
    }

    const buyOrder = "TDM-" + Math.floor(Math.random() * 100000);
    const sessionId = "SES-" + Math.floor(Math.random() * 100000);
    const returnUrl = `https://transferdelmar.cl/confirmacion`; 

    // 3. Inicialización Explícita
    const tx = new WebpayPlus.Transaction(new Options(commerceCode, apiKey, envConfig));

    // Aquí es donde ocurre el 401 si las credenciales no coinciden con el ambiente
    const createResponse = await tx.create(buyOrder, sessionId, amount, returnUrl);

    // 4. Guardado en Supabase (Try-catch para no bloquear el pago)
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
      console.error("Error (No crítico) en Supabase:", dbErr.message);
    }

    // 5. Respuesta al Frontend
    return res.status(200).json({
      url: createResponse.url,
      token: createResponse.token
    });

  } catch (error) {
    console.error("ERROR DETECTADO:", error.message);
    // Enviamos el detalle al front para saber exactamente qué falló
    return res.status(500).json({ 
      error: "Error de autorización con Transbank", 
      details: error.message 
    });
  }
};
