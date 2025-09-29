/**
 * 图片处理工具函数
 * 用于压缩图片、转换格式等操作
 */

/**
 * 压缩图片文件
 * @param file 原始图片文件
 * @param maxWidth 最大宽度，默认800px
 * @param maxHeight 最大高度，默认800px
 * @param quality 压缩质量，0-1之间，默认0.8
 * @returns 压缩后的文件
 */
export const compressImage = async (
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.8
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // 计算压缩后的尺寸
      let { width, height } = img
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }
      }

      // 设置canvas尺寸
      canvas.width = width
      canvas.height = height

      // 绘制压缩后的图片
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height)
        
        // 转换为blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // 创建新的File对象
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              })
              
              console.log(`图片压缩完成: ${file.size} -> ${compressedFile.size} (${Math.round((1 - compressedFile.size/file.size) * 100)}% 减少)`)
              resolve(compressedFile)
            } else {
              reject(new Error('图片压缩失败'))
            }
          },
          file.type,
          quality
        )
      } else {
        reject(new Error('无法获取canvas上下文'))
      }
    }

    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * 将文件转换为base64
 * @param file 文件对象
 * @returns base64字符串
 */
export const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 检查文件大小是否超出限制
 * @param file 文件对象
 * @param maxSizeMB 最大大小(MB)，默认5MB
 * @returns 是否超出限制
 */
export const isFileSizeExceeded = (file: File, maxSizeMB: number = 5): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024
  return file.size > maxSizeBytes
}

/**
 * 格式化文件大小显示
 * @param bytes 字节数
 * @returns 格式化的大小字符串
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
