import { useRef, useState } from 'react'

const MAX_DIMENSION = 256
const JPEG_QUALITY = 0.8

// There's no file/object storage in this project (no S3/Cloudinary), so an
// uploaded photo is resized down to a small square and compressed to a JPEG
// data URI entirely in the browser, then stored inline on the user document.
// That keeps it cheap enough for a demo-scale app without adding infra —
// it would need real storage before this could scale further.
function resizeAndCompress(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not a valid image'))
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
        const width = Math.round(img.width * scale)
        const height = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function initialsOf(firstName, lastName) {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?'
}

function ProfilePictureUpload({ value, onChange, firstName, lastName }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    setError('')
    try {
      const dataUri = await resizeAndCompress(file)
      onChange(dataUri)
    } catch (err) {
      setError(err.message || 'Could not process that image.')
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFile(e.dataTransfer.files?.[0])
        }}
        className={`flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed text-xl font-semibold text-white transition ${
          dragging ? 'border-teal' : 'border-slate-300'
        }`}
        style={!value ? { backgroundColor: 'rgb(0, 150, 135)' } : undefined}
        title="Click or drag an image to upload"
      >
        {value ? (
          <img src={value} alt="Profile" className="h-full w-full object-cover" />
        ) : (
          initialsOf(firstName, lastName)
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          {value ? 'Change photo' : 'Upload photo'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="ml-2 text-sm text-slate-400 hover:text-red-600 hover:underline"
          >
            Remove
          </button>
        )}
        <p className="mt-1 text-xs text-slate-400">Click or drag & drop. Resized automatically.</p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  )
}

export default ProfilePictureUpload
