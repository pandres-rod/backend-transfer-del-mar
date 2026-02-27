const { WebpayPlus, Options, Environment } = require('transbank-sdk');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Solo POST' });

  try {
    const { tour_name, amount, customer_email, customer_name, customer_phone } = req.body;
    
    // Configuración de Identificadores
    const buyOrder = "TDM-" + Math.floor(Math.random() * 100000);
    const sessionId = "SES-" + Math.floor(Math.random() * 100000);
    const returnUrl = `https://transferdelmar.cl/confirmacion`; 

    // 1. FORZAR CONFIGURACIÓN DE PRODUCCIÓN O INTEGRACIÓN
    const commerceCode = process.env.TBE_COMMERCE_CODE;
    const apiKey = process.env.TBE_API_KEY;
    const environment = process.env.TBE_ENVIRONMENT === 'PRODUCTION' 
      ? Environment.Production 
      : Environment.Integration;

    // Inicializamos con las opciones explícitas para que use TU Código de Comercio
    const tx = new WebpayPlus.Transaction(new Options(commerceCode, apiKey, environment));

    // 2. Crear transacción en Transbank
    const createResponse = await tx.create(buyOrder, sessionId, amount, returnUrl);

    // 3. Persistencia en Supabase
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60000);

    // Intentamos guardar en Supabase, pero no bloqueamos el pago si falla
    try {
      const { error: supabaseError } = await supabase.from('orders').insert([{
        order_id: buyOrder,
        tour_name: tour_name,
        amount: amount,
        currency: 'CLP',
        customer_email: customer_email,
        customer_name: customer_name,
        customer_phone: customer_phone,
        token: createResponse.token,
        status: 'PENDING',
        expires_at: expiresAt.toISOString()
      }]);

      if (supabaseError) {
        console.error("Error de inserción en Supabase:", supabaseError);
      } else {
        console.log("Orden registrada exitosamente en Supabase");
      }
    } catch (err) {
      console.error("Error crítico de conexión con Supabase:", err);
    }
    // El código seguirá aquí abajo y ejecutará el return res.status(200)...

    // 4. Retorno exacto al front: URL (redirect_url) y Token
    return res.status(200).json({
      url: createResponse.url,
      token: createResponse.token
    });

  } catch (error) {
    console.error("Webpay Create Error:", error);
    return res.status(500).json({ error: error.message });
  }
};
