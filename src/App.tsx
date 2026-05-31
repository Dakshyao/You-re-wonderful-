/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  Camera, 
  Sun, 
  Maximize, 
  Loader2, 
  RefreshCw,
  AlertCircle,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";

// Types
type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
type Lighting = "Soft Lighting" | "Hard Lighting" | "Golden hour" | "Backlighting" | "Neon Lighting";
type CameraAngle = "Close angle shot" | "wide angle shot" | "over the shoulder shot" | "top view shot" | "High angle shot" | "low angle shot" | "eye level shot" | "dutch angle shot";
type Composition = "Rule of third" | "leading lines" | "center composition" | "Negative space" | "depth composition";
type ColorMood = "bright and clean" | "Dark and moody" | "warm and golden" | "cool and blue" | "neon / color pop" | "None";

interface PhotoState {
  file: File | null;
  preview: string | null;
  base64: string | null;
}

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-black text-white">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold">Something went wrong</h2>
            <p className="text-zinc-400 text-sm">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  // State
  const [productPhoto, setProductPhoto] = useState<PhotoState>({ file: null, preview: null, base64: null });
  const [styleReference, setStyleReference] = useState<PhotoState>({ file: null, preview: null, base64: null });
  
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [lighting, setLighting] = useState<Lighting>("Soft Lighting");
  const [cameraAngle, setCameraAngle] = useState<CameraAngle>("eye level shot");
  const [composition, setComposition] = useState<Composition>("center composition");
  const [colorMood, setColorMood] = useState<ColorMood>("None");
  
  const [customScene, setCustomScene] = useState("");
  const [useCustomScene, setUseCustomScene] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image Compression Utility
  const compressImage = (base64Str: string, maxWidth = 1024, maxHeight = 1024, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => reject(err);
    });
  };

  // Dropzones
  const onDropProduct = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64WithPrefix = reader.result as string;
        try {
          const compressedDataUrl = await compressImage(base64WithPrefix);
          setProductPhoto({
            file,
            preview: URL.createObjectURL(file),
            base64: compressedDataUrl.split(",")[1]
          });
        } catch (err) {
          console.error("Compression failed:", err);
          setProductPhoto({
            file,
            preview: URL.createObjectURL(file),
            base64: base64WithPrefix.split(",")[1]
          });
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const onDropStyle = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64WithPrefix = reader.result as string;
        try {
          const compressedDataUrl = await compressImage(base64WithPrefix);
          setStyleReference({
            file,
            preview: URL.createObjectURL(file),
            base64: compressedDataUrl.split(",")[1]
          });
        } catch (err) {
          console.error("Compression failed:", err);
          setStyleReference({
            file,
            preview: URL.createObjectURL(file),
            base64: base64WithPrefix.split(",")[1]
          });
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps: getProductProps, getInputProps: getProductInput, isDragActive: isProductActive } = useDropzone({
    onDrop: onDropProduct,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    multiple: false
  } as any);

  const { getRootProps: getStyleProps, getInputProps: getStyleInput, isDragActive: isStyleActive } = useDropzone({
    onDrop: onDropStyle,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    multiple: false
  } as any);

  // Gemini Logic
  const generatePrompt = async () => {
    if (!productPhoto.base64) {
      setError("Please upload a product photo first.");
      return;
    }
    
    setIsGeneratingPrompt(true);
    setError(null);
    setGeneratedPrompt("");
    
    try {
      const response = await fetch("/api/generate-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          productPhotoBase64: productPhoto.base64,
          styleReferenceBase64: styleReference.base64 || null,
          useCustomScene,
          customScene,
          aspectRatio,
          lighting,
          cameraAngle,
          composition,
          colorMood
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate prompt.");
      }

      setGeneratedPrompt(data.prompt || "");
    } catch (err: any) {
      console.error("Gemini Error:", err);
      const errorMessage = err?.message || "Failed to generate prompt. Please check your connection and API key.";
      setError(`Gemini Error: ${errorMessage}`);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto relative flex flex-col justify-between">
      <div>
        {/* Top bar with Reset option */}
        <motion.div 
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 mb-10 pb-4 border-b border-zinc-900/80"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-500" />
            <span className="font-display font-semibold text-lg text-zinc-100">Shoot Prompt Studio</span>
          </div>
          <button
            onClick={() => {
              setProductPhoto({ file: null, preview: null, base64: null });
              setStyleReference({ file: null, preview: null, base64: null });
              setGeneratedPrompt("");
              setError(null);
              setCustomScene("");
              setUseCustomScene(false);
            }}
            className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all cursor-pointer flex items-center gap-2 px-3 text-xs"
            title="Reset All"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset All</span>
          </button>
        </motion.div>

        {/* Header */}
        <header className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm mb-4"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Powered by Nano Banana</span>
          </motion.div>
          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-orange-500 bg-clip-text text-transparent">
            You're wonderful
          </h1>
          <p className="text-zinc-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Transform your product shots into highly detailed, professional photoshoot prompts with AI-driven styles and compositions.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Uploads */}
          <div className="lg:col-span-4 space-y-6">
            <section className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-orange-400" />
                Product Photo
              </h2>
              <div 
                {...getProductProps()} 
                className={cn(
                  "relative aspect-square rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center gap-4",
                  isProductActive ? "border-orange-500 bg-orange-500/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700",
                  productPhoto.preview && "border-none"
                )}
              >
                <input {...getProductInput()} />
                {productPhoto.preview ? (
                  <>
                    <img src={productPhoto.preview} alt="Product" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white font-medium">Change Photo</p>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6">
                    <Upload className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
                    <p className="text-zinc-400 font-medium font-sans">Drop product photo here</p>
                    <p className="text-zinc-600 text-sm mt-1">PNG, JPG up to 10MB</p>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-400" />
                Style Reference
              </h2>
              <div 
                {...getStyleProps()} 
                className={cn(
                  "relative aspect-video rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center gap-4",
                  isStyleActive ? "border-orange-500 bg-orange-500/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700",
                  styleReference.preview && "border-none"
                )}
              >
                <input {...getStyleInput()} />
                {styleReference.preview ? (
                  <>
                    <img src={styleReference.preview} alt="Style" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white font-medium">Change Style</p>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <Upload className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                    <p className="text-zinc-400 text-sm font-medium">Upload style reference (optional)</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Controls & Textarea */}
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Aspect Ratio */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                    <Maximize className="w-4 h-4" />
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["1:1", "3:4", "4:3", "9:16", "16:9"] as AspectRatio[]).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer",
                          aspectRatio === ratio 
                            ? "bg-white text-black border-white" 
                            : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600"
                        )}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lighting */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                    <Sun className="w-4 h-4" />
                    Lighting
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {(["Soft Lighting", "Hard Lighting", "Golden hour", "Backlighting", "Neon Lighting"] as Lighting[]).map((style) => (
                      <button
                        key={style}
                        onClick={() => setLighting(style)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left cursor-pointer",
                          lighting === style 
                            ? "bg-white text-black border-white" 
                            : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600"
                        )}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Camera Angle */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Camera Angle
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {(["Close angle shot", "wide angle shot", "over the shoulder shot", "top view shot", "High angle shot", "low angle shot", "eye level shot", "dutch angle shot"] as CameraAngle[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setCameraAngle(p)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left cursor-pointer",
                          cameraAngle === p 
                            ? "bg-white text-black border-white" 
                            : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-zinc-800">
                {/* Composition */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                    <Maximize className="w-4 h-4" />
                    Composition
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["Rule of third", "leading lines", "center composition", "Negative space", "depth composition"] as Composition[]).map((c) => (
                      <button
                        key={c}
                        onClick={() => setComposition(c)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left cursor-pointer",
                          composition === c 
                            ? "bg-white text-black border-white" 
                            : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600"
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Mood */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Color Mood (Optional)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["bright and clean", "Dark and moody", "warm and golden", "cool and blue", "neon / color pop", "None"] as ColorMood[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setColorMood(m)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left cursor-pointer",
                          colorMood === m 
                            ? "bg-white text-black border-white" 
                            : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600"
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Custom Scene Option */}
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-400" />
                    Create your own scene
                  </label>
                  <button
                    onClick={() => setUseCustomScene(!useCustomScene)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer",
                      useCustomScene ? "bg-orange-600" : "bg-zinc-800"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        useCustomScene ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
                
                <AnimatePresence>
                  {useCustomScene && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <textarea
                        value={customScene}
                        onChange={(e) => setCustomScene(e.target.value)}
                        placeholder="Describe the scene (e.g., 'A minimalist marble countertop with soft morning light and a blurred kitchen background')"
                        className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all resize-none text-sm"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action Button */}
              <button
                onClick={generatePrompt}
                disabled={isGeneratingPrompt || !productPhoto.base64}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg shadow-xl shadow-orange-900/20 transition-all flex items-center justify-center gap-3 group cursor-pointer"
              >
                {isGeneratingPrompt ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Generating Prompt...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span>Generate AI Prompt</span>
                  </>
                )}
              </button>

              {/* Error Display */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl"
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p className="text-sm flex-1">{error}</p>
                      <button 
                        onClick={() => { setError(null); }}
                        className="p-1 hover:bg-red-500/10 rounded-full transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Prompt Output Display */}
              <AnimatePresence>
                {generatedPrompt && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 pt-6 border-t border-zinc-800"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-orange-400" />
                        AI Shoot Prompt
                      </h3>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(generatedPrompt);
                          } catch (err) {
                            console.error("Failed to copy text: ", err);
                            setError("Failed to copy to clipboard.");
                          }
                        }}
                        className="text-sm font-medium text-orange-400 hover:text-orange-300 transition-colors bg-orange-500/10 hover:bg-orange-500/20 px-3.5 py-1.5 rounded-xl cursor-pointer"
                      >
                        Copy Prompt
                      </button>
                    </div>
                    <textarea
                      value={generatedPrompt}
                      onChange={(e) => setGeneratedPrompt(e.target.value)}
                      placeholder="The AI will generate a detailed prompt here, or you can write your own..."
                      className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-mono text-sm leading-relaxed"
                    />
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Copy this prompt and paste it into your favorite image generator (like Midjourney, Stable Diffusion, or DALL-E) to render high-end commercial photoshoot assets.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 pt-8 border-t border-zinc-900/80 text-center text-zinc-650 text-sm">
        <p>&copy; 2026 You're wonderful. AI-driven creative prompt assistant.</p>
      </footer>
    </div>
  );
}
