// SERVIÇO DE GERAÇÃO AUTOMÁTICA DE MÍDIA
const ContentAI = require('./ai');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');

class MediaGenerator {
  constructor() {
    this.ai = new ContentAI();
    this.tempDir = path.join(process.cwd(), 'temp', 'media');
    this.ensureTempDir();
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (err) {
      console.log('Temp dir already exists');
    }
  }

  // 1. GERAR CARROSSEL COMPLETO PARA INSTAGRAM
  async generateInstagramCarousel(topic, options = {}) {
    try {
      console.log(`[MediaGen] Gerando carrossel: ${topic}`);
      
      // Gerar estrutura do carrossel com IA
      const carousel = await this.ai.generateCarousel(topic, options.slides || 5);
      
      const mediaFiles = [];
      const slideData = [];
      
      // Gerar imagem para cada slide
      for (let i = 0; i < carousel.slides.length; i++) {
        const slide = carousel.slides[i];
        
        // Prompt para imagem do slide
        const imagePrompt = `
        Professional Instagram carousel slide, clean design, modern typography,
        visual representation of: ${slide.visual || slide.title},
        social media content, 1080x1080 pixels, high quality
        `;
        
        // Gerar imagem
        const imageData = await this.ai.generateImage(imagePrompt, 'professional');
        
        // Baixar e salvar imagem localmente
        const imagePath = await this.saveImageFromUrl(imageData.imageUrl, `carousel_${topic}_slide_${i + 1}`);
        
        slideData.push({
          title: slide.title,
          text: slide.text,
          imagePath: imagePath,
          order: i + 1
        });
        
        mediaFiles.push(imagePath);
      }
      
      // Criar arquivo de metadados do carrossel
      const carouselData = {
        title: carousel.title,
        topic: topic,
        slides: slideData,
        mediaFiles: mediaFiles,
        createdAt: new Date().toISOString(),
        platform: 'instagram'
      };
      
      const metadataPath = path.join(this.tempDir, `carousel_${topic}_metadata.json`);
      await fs.writeFile(metadataPath, JSON.stringify(carouselData, null, 2));
      
      console.log(`[MediaGen] Carrossel gerado: ${mediaFiles.length} slides`);
      
      return {
        success: true,
        carousel: carouselData,
        mediaFiles: mediaFiles,
        metadataPath: metadataPath
      };
      
    } catch (error) {
      console.error('[MediaGen] Erro ao gerar carrossel:', error);
      return { success: false, error: error.message };
    }
  }

  // 2. GERAR CONJUNTO DE IMAGENS PARA POST
  async generatePostMedia(topic, platform, options = {}) {
    try {
      console.log(`[MediaGen] Gerando mídia para post: ${topic}`);
      
      const mediaFiles = [];
      
      // Gerar imagem principal
      const mainPrompt = this.getMainPrompt(topic, platform, options);
      const mainImage = await this.ai.generateImage(mainPrompt, 'professional');
      const mainImagePath = await this.saveImageFromUrl(mainImage.imageUrl, `main_${topic}`);
      mediaFiles.push(mainImagePath);
      
      // Gerar imagens secundárias se necessário
      if (options.variations > 1) {
        for (let i = 1; i < options.variations; i++) {
          const variationPrompt = `${mainPrompt}, different angle, variation ${i}`;
          const variationImage = await this.ai.generateImage(variationPrompt, 'professional');
          const variationPath = await this.saveImageFromUrl(variationImage.imageUrl, `variation_${topic}_${i}`);
          mediaFiles.push(variationPath);
        }
      }
      
      // Criar metadados
      const mediaData = {
        topic: topic,
        platform: platform,
        mediaFiles: mediaFiles,
        mainImage: mainImagePath,
        variations: mediaFiles.length - 1,
        createdAt: new Date().toISOString()
      };
      
      const metadataPath = path.join(this.tempDir, `post_${topic}_media.json`);
      await fs.writeFile(metadataPath, JSON.stringify(mediaData, null, 2));
      
      console.log(`[MediaGen] Mídia gerada: ${mediaFiles.length} arquivos`);
      
      return {
        success: true,
        mediaFiles: mediaFiles,
        mainImage: mainImagePath,
        metadata: mediaData,
        metadataPath: metadataPath
      };
      
    } catch (error) {
      console.error('[MediaGen] Erro ao gerar mídia:', error);
      return { success: false, error: error.message };
    }
  }

  // 3. GERAR VÍDEO CURTO (REELS/TIKTOK)
  async generateShortVideo(topic, options = {}) {
    try {
      console.log(`[MediaGen] Gerando vídeo curto: ${topic}`);
      
      // Gerar roteiro com IA
      const script = await this.ai.generateVideoScript(topic, options.duration || '60s');
      
      const scenes = [];
      
      // Gerar frames para cada cena
      for (let i = 0; i < script.scenes.length; i++) {
        const scene = script.scenes[i];
        
        const framePrompt = `
        Professional video frame scene, ${scene.visual || 'modern clean background'},
        social media content, 1920x1080 pixels, cinematic lighting
        `;
        
        const frameImage = await this.ai.generateImage(framePrompt, 'cinematic');
        const framePath = await this.saveImageFromUrl(frameImage.imageUrl, `video_${topic}_scene_${i + 1}`);
        
        scenes.push({
          time: scene.time,
          script: scene.script,
          visual: scene.visual,
          framePath: framePath
        });
      }
      
      // Criar metadados do vídeo
      const videoData = {
        title: script.title,
        hook: script.hook,
        scenes: scenes,
        duration: options.duration || '60s',
        topic: topic,
        platform: options.platform || 'tiktok',
        createdAt: new Date().toISOString()
      };
      
      const metadataPath = path.join(this.tempDir, `video_${topic}_metadata.json`);
      await fs.writeFile(metadataPath, JSON.stringify(videoData, null, 2));
      
      console.log(`[MediaGen] Vídeo gerado: ${scenes.length} cenas`);
      
      return {
        success: true,
        video: videoData,
        scenes: scenes,
        metadataPath: metadataPath
      };
      
    } catch (error) {
      console.error('[MediaGen] Erro ao gerar vídeo:', error);
      return { success: false, error: error.message };
    }
  }

  // 4. CRIAR CONJUNTO DE CONTEÚDO COMPLETO
  async generateCompleteContent(topic, platform, options = {}) {
    try {
      console.log(`[MediaGen] Gerando conteúdo completo: ${topic}`);
      
      const content = {
        topic: topic,
        platform: platform,
        generatedAt: new Date().toISOString(),
        components: {}
      };
      
      // Gerar ideias de conteúdo
      const ideas = await this.ai.generateContentIdeas(topic, platform);
      content.components.ideas = ideas;
      
      // Gerar texto do post
      const postText = await this.ai.generatePostContent(
        ideas.title || topic,
        ideas.description || `Conteúdo sobre ${topic}`,
        platform
      );
      content.components.text = postText;
      
      // Gerar mídia visual
      if (platform === 'instagram') {
        if (options.format === 'carousel') {
          content.components.media = await this.generateInstagramCarousel(topic, options);
        } else {
          content.components.media = await this.generatePostMedia(topic, platform, options);
        }
      } else if (platform === 'tiktok' || platform === 'youtube') {
        content.components.media = await this.generateShortVideo(topic, options);
      }
      
      // Salvar tudo em um pacote
      const packagePath = path.join(this.tempDir, `complete_${topic}_${Date.now()}.json`);
      await fs.writeFile(packagePath, JSON.stringify(content, null, 2));
      
      console.log(`[MediaGen] Conteúdo completo gerado: ${packagePath}`);
      
      return {
        success: true,
        content: content,
        packagePath: packagePath
      };
      
    } catch (error) {
      console.error('[MediaGen] Erro ao gerar conteúdo completo:', error);
      return { success: false, error: error.message };
    }
  }

  // FUNÇÕES AUXILIARES
  async saveImageFromUrl(url, filename) {
    try {
      const filePath = path.join(this.tempDir, `${filename}.png`);

      if (url.startsWith('data:')) {
        const matches = url.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) throw new Error('Formato data URL invalido');
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const finalPath = path.join(this.tempDir, `${filename}.${ext}`);
        const buffer = Buffer.from(matches[2], 'base64');
        await fs.writeFile(finalPath, buffer);
        return finalPath;
      }

      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream'
      });

      const writer = fsSync.createWriteStream(filePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
      });

    } catch (error) {
      console.error('[MediaGen] Erro ao salvar imagem:', error);
      throw error;
    }
  }

  getMainPrompt(topic, platform, options = {}) {
    const basePrompts = {
      instagram: 'Professional Instagram post, high quality, engaging visual, modern design',
      tiktok: 'TikTok video thumbnail, eye-catching, trending style, 1920x1080',
      youtube: 'YouTube thumbnail, professional, clear text overlay, high contrast'
    };
    
    const style = options.style || 'professional';
    return `${basePrompts[platform] || basePrompts.instagram}, ${style} style, about: ${topic}`;
  }

  // LIMPEZA DE ARQUIVOS TEMPORÁRIOS
  async cleanupOldFiles(hoursOld = 24) {
    try {
      const cutoffTime = Date.now() - (hoursOld * 60 * 60 * 1000);
      const files = await fs.readdir(this.tempDir);
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          console.log(`[MediaGen] Arquivo removido: ${file}`);
        }
      }
    } catch (error) {
      console.error('[MediaGen] Erro na limpeza:', error);
    }
  }
}

module.exports = MediaGenerator;