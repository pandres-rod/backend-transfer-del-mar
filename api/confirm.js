const { WebpayPlus, Options, Environment } = require('transbank-sdk');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  // Transbank envía el token por POST o GET dependiendo del flujo
  const token = req.body.token_ws || req.query.token_ws;

  if (!token) {
    return res.redirect('https://transferdelmar.cl/error-pago');
  }

  try {
    const tx = new WebpayPlus.Transaction(new Options(
      process.env.TBE_COMMERCE_CODE, 
      process.env.TBE_API_KEY, 
      process.env.TBE_ENVIRONMENT === 'PRODUCTION' ? Environment.Production : Environment.Integration
    ));

    // 1. Confirmar la transacción con Transbank
    const result = await tx.commit(token);

    if (result.response_code === 0) {
      // 2. Si el pago es exitoso, actualizamos Supabase
      await supabase
        .from('orders')
        .update({ status: 'PAID', details: JSON.stringify(result) })
        .eq('token', token);

      return res.redirect('https://transferdelmar.cl/confirmacion?status=success');
    } else {
      // Pago rechazado por el banco
      return res.redirect('https://transferdelmar.cl/confirmacion?status=rejected');
    }
  } catch (error) {
    console.error("Error confirmando pago:", error.message);
    return res.redirect('https://transferdelmar.cl/confirmacion?status=error');
  }
};
