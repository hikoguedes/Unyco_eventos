const fs = require('fs');
const path = require('path');

/**
 * Controller para Upload de Imagens e Arquivos Estáticos
 * Suporta imagens em Base64 (Data URLs) enviadas a partir do navegador
 */
exports.uploadImage = async (req, res) => {
  try {
    const { image, filename, folder = 'avatars' } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum dado de imagem foi enviado no corpo da requisição.'
      });
    }

    // Identificar formato Base64 ou Data URL
    let buffer;
    let ext = 'jpg';

    const matches = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (matches) {
      ext = matches[1].toLowerCase() === 'jpeg' ? 'jpg' : matches[1].toLowerCase();
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(image, 'base64');
    }

    // Sanitizar nome de pasta e arquivo
    const safeFolder = (folder || 'avatars').replace(/[^a-zA-Z0-9_-]/g, '') || 'avatars';
    const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads', safeFolder);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 100000);
    const cleanName = filename
      ? path.basename(filename).replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/\.[^/.]+$/, '')
      : 'foto';
    
    const finalFilename = `${cleanName}_${timestamp}_${random}.${ext}`;
    const targetFilePath = path.join(uploadDir, finalFilename);

    fs.writeFileSync(targetFilePath, buffer);

    const publicUrl = `/uploads/${safeFolder}/${finalFilename}`;

    return res.status(201).json({
      success: true,
      message: 'Imagem carregada com sucesso a partir do computador!',
      url: publicUrl,
      filename: finalFilename,
      size: buffer.length,
      mime: `image/${ext}`,
    });
  } catch (error) {
    console.error('Erro no upload de imagem:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao processar e salvar a imagem enviada.',
      error: error.message
    });
  }
};
