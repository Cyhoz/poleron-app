const nodemailer = require('nodemailer');
const ExcelJS = require('exceljs');
const { decrypt } = require('./encryption');

/**
 * Genera un archivo Excel y lo envía por correo electrónico al administrador
 * @param {Object} orderData Datos del pedido
 */
async function sendOrderEmail(orderData) {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Pedido');

        // Styles
        const titleStyle = { font: { bold: true, size: 14 } };
        const headerStyle = { font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } } };

        // 1. Datos del Solicitante (Requester)
        sheet.addRow(['DATOS DEL SOLICITANTE']).font = titleStyle;
        sheet.addRow(['Nombre', 'Apellido', 'Correo', 'Teléfono']);
        const reqInfo = orderData.requesterInfo || {};
        sheet.addRow([
            reqInfo.nombre || 'N/A',
            reqInfo.apellido || 'N/A',
            reqInfo.email || 'N/A',
            reqInfo.telefono || 'N/A'
        ]);
        sheet.addRow([]); // Espacio

        // 2. Datos del Grupo (si aplica)
        if (orderData.type === 'GROUP_ORDER') {
            sheet.addRow(['DATOS DEL GRUPO']).font = titleStyle;
            sheet.addRow(['Colegio', 'Curso', 'Región', 'Ciudad']);
            const g = orderData.groupInfo || {};
            sheet.addRow([
                g.colegio || 'N/A',
                g.curso || 'N/A',
                g.region || 'N/A',
                g.ciudad || 'N/A'
            ]);
            sheet.addRow([]);
        }

        // 3. Detalle de Estudiantes
        sheet.addRow(['DETALLE DEL PEDIDO']).font = titleStyle;
        sheet.addRow(['Producto', orderData.producto || 'Polerón']);
        sheet.addRow(['Fecha', new Date(orderData.date).toLocaleString()]);
        sheet.addRow([]);

        sheet.addRow(['#', 'Nombre', 'Apellido', 'Apodo', 'Talla']).font = headerStyle;
        
        const list = orderData.estudiantes || [];
        list.forEach((s, i) => {
            sheet.addRow([
                i + 1,
                s.nombre || '',
                s.apellido || '',
                s.apodo || '',
                s.talla || ''
            ]);
        });

        // 4. Totales
        sheet.addRow([]);
        sheet.addRow(['CANTIDAD TOTAL', orderData.cantidadTotal || list.length]);

        // Ajustar ancho de columnas
        sheet.columns.forEach(column => {
            column.width = 20;
        });

        // Generar Buffer del Excel
        const buffer = await workbook.xlsx.writeBuffer();

        // CONFIGURACIÓN DE NODEMAILER (SSL/TLS para máxima seguridad)
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            secure: true, // Forzamos el uso de una conexión segura
            auth: {
                user: process.env.SMTP_USER || 'inzunzajuan202@gmail.com',
                pass: process.env.SMTP_PASS 
            },
            tls: {
                rejectUnauthorized: true // Verificar certificados para prevenir ataques Man-in-the-Middle
            }
        });

        const adminEmail = process.env.ADMIN_EMAIL || 'inzunzajuan202@gmail.com';
        const requesterName = reqInfo.nombre ? `${reqInfo.nombre} ${reqInfo.apellido}` : 'Un cliente';

        const mailOptions = {
            from: `"App Poleron Orders" <${process.env.SMTP_USER || 'inzunzajuan202@gmail.com'}>`,
            to: adminEmail,
            subject: `Pedido de Poleron Nuevo - ${requesterName} (${orderData.groupInfo?.colegio || 'Venta Local'})`,
            text: `Se ha recibido un nuevo pedido grupal.\n\nSolicitante: ${requesterName}\nColegio: ${orderData.groupInfo?.colegio || 'N/A'}\nCurso: ${orderData.groupInfo?.curso || 'N/A'}\n\nAdjunto encontrarás el detalle en Excel.`,
            attachments: [
                {
                    filename: `Pedido_${orderData.groupInfo?.colegio || 'SinColegio'}_${Date.now()}.xlsx`,
                    content: buffer
                }
            ]
        };

        // Adjuntar archivos de diseño (múltiples)
        if (orderData.disenos && Array.isArray(orderData.disenos)) {
            orderData.disenos.forEach((file, index) => {
                if (file.base64) {
                    mailOptions.attachments.push({
                        filename: file.name || `archivo_${index + 1}`,
                        content: file.base64,
                        encoding: 'base64',
                        contentType: file.mimeType
                    });
                }
            });
        }

        // Mantener compatibilidad con pedidos individuales viejos
        if (orderData.disenoBase64) {
            mailOptions.attachments.push({
                filename: 'diseno_principal.png',
                content: orderData.disenoBase64,
                encoding: 'base64'
            });
        }

        await transporter.sendMail(mailOptions);
        console.log('✅ Email enviado con éxito a:', adminEmail);
        
    } catch (error) {
        console.error('❌ Error en sendOrderEmail:', error);
        throw error;
    }
}

module.exports = { sendOrderEmail };
