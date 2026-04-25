/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect, Component, ErrorInfo, ReactNode } from "react";
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
  Download,
  AlertCircle,
  History as HistoryIcon,
  LogOut,
  User as UserIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { cn } from "@/src/lib/utils";
import { storage, User as LocalUser, HistoryItem as LocalHistoryItem } from "./lib/storage";

// Types
type User = LocalUser;
type HistoryItem = LocalHistoryItem;
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
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
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // State
  const resultRef = React.useRef<HTMLDivElement>(null);
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
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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

  // Auth Listener
  useEffect(() => {
    const savedUser = storage.getUser();
    if (savedUser) {
      setUser(savedUser);
    }
    setIsAuthReady(true);
  }, []);

  // History Listener (Local Storage)
  useEffect(() => {
    if (!isAuthReady) return;
    
    // We use a "local" UID if not signed in, or the actual UID
    const uid = user ? user.uid : "local";
    const localHistory = storage.getHistory(uid);
    setHistory(localHistory);
  }, [user, isAuthReady, showHistory]); // Refresh when history is shown or user changes

  // Auth Actions
  const handleLogin = async () => {
    if (isLoggingIn) return;
    
    setIsLoggingIn(true);
    setError(null);
    
    try {
      // Create a mock user for local authentication
      const mockUser: User = {
        uid: "user_" + Math.random().toString(36).substring(2, 11),
        displayName: "Wonderful User",
        email: "user@example.com",
        photoURL: null
      };
      setUser(mockUser);
      storage.saveUser(mockUser);
    } catch (err: any) {
      console.error("Login Error:", err);
      setError(`Sign in failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      setUser(null);
      storage.clearUser();
      setHistory([]);
      setShowHistory(false);
    } catch (err: any) {
      console.error("Logout Error:", err);
    }
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
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const parts: any[] = [
        { text: `Generate a highly detailed, professional product photography prompt for an AI image generator. 
          The product is shown in the first image. 
          ${styleReference.base64 ? "The desired style should be influenced by the second image." : ""}
          ${useCustomScene && customScene ? `The scene should be: ${customScene}` : ""}
          
          Parameters:
          - Aspect Ratio: ${aspectRatio}
          - Lighting: ${lighting}
          - Camera Angle: ${cameraAngle}
          - Composition: ${composition}
          ${colorMood !== "None" ? `- Color Mood: ${colorMood}` : ""}
          
          The prompt should describe the environment, background, textures, and mood. 
          Focus on making the product look premium and appealing.
          Output ONLY the prompt text, no extra commentary.` }
      ];

      parts.push({
        inlineData: {
          data: productPhoto.base64,
          mimeType: productPhoto.file?.type || "image/png"
        }
      });

      if (styleReference.base64) {
        parts.push({
          inlineData: {
            data: styleReference.base64,
            mimeType: styleReference.file?.type || "image/png"
          }
        });
      }

      const response = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: { parts }
      });

      let fullText = "";
      for await (const chunk of response) {
        fullText += chunk.text || "";
        setGeneratedPrompt(fullText);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to generate prompt. Please check your connection and try again.");
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const generateImage = async () => {
    if (!productPhoto.base64 || !generatedPrompt) {
      setError("Product photo and prompt are required.");
      return;
    }

    setIsGeneratingImage(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [
            {
              inlineData: {
                data: productPhoto.base64,
                mimeType: "image/jpeg"
              }
            },
            { text: generatedPrompt }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any
          }
        }
      });

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("No candidates returned from AI model.");
      }

      const imagePart = response.candidates[0].content.parts.find(p => p.inlineData);
      if (imagePart?.inlineData?.data) {
        const originalBase64 = `data:image/png;base64,${imagePart.inlineData.data}`;
        
        // Compress image to stay under 1MB Firestore limit
        let base64Image = originalBase64;
        try {
          base64Image = await compressImage(originalBase64);
        } catch (compressErr) {
          console.warn("Compression failed, using original:", compressErr);
        }

        setResultImage(base64Image);
        
        // Scroll to result
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        
        // Add to Storage
        const uid = user ? user.uid : "local";
        const newItem: HistoryItem = {
          id: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
          uid: uid,
          image: base64Image,
          prompt: generatedPrompt,
          timestamp: Date.now(),
          params: {
            aspectRatio,
            lighting,
            cameraAngle,
            composition,
            colorMood
          }
        };
        
        storage.addHistoryItem(newItem);
        setHistory(prev => [newItem, ...prev]);
        
        // Automatically show history when first item is added
        if (history.length === 0) setShowHistory(true);
      } else {
        const textPart = response.candidates[0].content.parts.find(p => p.text);
        if (textPart?.text) {
          throw new Error(`AI returned text instead of image: ${textPart.text}`);
        }
        throw new Error("No image data received from the model.");
      }
    } catch (err: any) {
      console.error("Image Generation Error:", err);
      setError(err.message || "Failed to generate image. The model might be busy or the request was blocked by safety filters.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
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
        <div className="flex items-center justify-center gap-4">
          <p className="text-zinc-400 text-lg max-w-2xl">
            Transform your product shots into professional marketing assets with AI-driven lighting and style.
          </p>
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="User" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon className="w-4 h-4 text-zinc-500" />
                  )}
                  <span className="text-xs font-medium text-zinc-300 hidden md:inline">{user.displayName || user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-all"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-500 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserIcon className="w-4 h-4" />}
                {isLoggingIn ? "Signing in..." : "Sign In"}
              </button>
            )}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "p-2 rounded-xl border transition-all",
                showHistory ? "bg-orange-600 border-orange-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
              )}
              title="View History"
            >
              <HistoryIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setProductPhoto({ file: null, preview: null, base64: null });
                setStyleReference({ file: null, preview: null, base64: null });
                setGeneratedPrompt("");
                setResultImage(null);
                setError(null);
                setCustomScene("");
                setUseCustomScene(false);
              }}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
              title="Reset All"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-12 overflow-hidden"
          >
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-bold">History</h2>
                <div className="flex items-center gap-4">
                  {!user && (
                    <span className="text-xs text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg">Items stored locally in this browser</span>
                  )}
                  <button 
                    onClick={() => {
                      if (user) {
                        // In mock mode, we just clear local for this user
                        const data = localStorage.getItem('wonderful_history');
                        if (data) {
                          const allHistory = JSON.parse(data).filter((item: any) => item.uid !== user.uid);
                          localStorage.setItem('wonderful_history', JSON.stringify(allHistory));
                        }
                      } else {
                        // Clear local-only items
                        const data = localStorage.getItem('wonderful_history');
                        if (data) {
                          const allHistory = JSON.parse(data).filter((item: any) => item.uid !== "local");
                          localStorage.setItem('wonderful_history', JSON.stringify(allHistory));
                        }
                      }
                      setHistory([]);
                    }}
                    className="text-sm text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    Clear History
                  </button>
                </div>
              </div>
              {history.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <p className="text-zinc-500 italic">No history found.</p>
                  {!user && (
                    <button
                      onClick={handleLogin}
                      className="px-6 py-2 rounded-xl bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 transition-all"
                    >
                      Sign in to view your cloud history
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {history.map((item) => (
                    <motion.div
                      key={item.id}
                      layoutId={item.id}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-zinc-800 cursor-pointer"
                      onClick={() => {
                        setResultImage(item.image);
                        setGeneratedPrompt(item.prompt);
                        setAspectRatio(item.params.aspectRatio);
                        setLighting(item.params.lighting);
                        setCameraAngle(item.params.cameraAngle);
                        setComposition(item.params.composition);
                        setColorMood(item.params.colorMood);
                        
                        // Scroll to result
                        setTimeout(() => {
                          resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 100);
                      }}
                    >
                      <img src={item.image} alt="History" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 gap-2">
                        <p className="text-[10px] text-zinc-300 line-clamp-2 leading-tight text-center">{item.prompt}</p>
                        <a
                          href={item.image}
                          download={`generated-${item.id}.png`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg bg-orange-600 text-white hover:bg-orange-500 transition-colors"
                          title="Download"
                        >
                          <Download className="w-3 h-3" />
                        </a>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <p className="text-zinc-400 font-medium">Drop product photo here</p>
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

        {/* Middle Column: Controls */}
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
                        "px-3 py-2 rounded-xl text-xs font-medium border transition-all",
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
                        "px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left",
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
                        "px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left",
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
                        "px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left",
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
                        "px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left",
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
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
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

            {/* Prompt Generation */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">AI Prompt</h3>
                <div className="flex items-center gap-4">
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(generatedPrompt);
                      } catch (err) {
                        console.error("Failed to copy text: ", err);
                        setError("Failed to copy to clipboard. Please try selecting the text manually.");
                      }
                    }}
                    disabled={!generatedPrompt}
                    className="text-sm font-medium text-zinc-500 hover:text-zinc-300 disabled:opacity-50 transition-colors"
                  >
                    Copy
                  </button>
                  <button
                    onClick={generatePrompt}
                    disabled={isGeneratingPrompt || !productPhoto.base64}
                    className="flex items-center gap-2 text-sm font-medium text-orange-400 hover:text-orange-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGeneratingPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Generate Prompt
                  </button>
                </div>
              </div>
              <textarea
                value={generatedPrompt}
                onChange={(e) => setGeneratedPrompt(e.target.value)}
                placeholder="The AI will generate a detailed prompt here, or you can write your own..."
                className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all resize-none"
              />
            </div>

            {/* Error Display */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-center gap-3"
                >
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Button */}
            <button
              onClick={generateImage}
              disabled={isGeneratingImage || !generatedPrompt || !productPhoto.base64}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg shadow-xl shadow-orange-900/20 transition-all flex items-center justify-center gap-3 group"
            >
              {isGeneratingImage ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Generating Masterpiece...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  <span>Generate AI Photo</span>
                </>
              )}
            </button>
          </div>

          {/* Result Section */}
          <AnimatePresence>
            {resultImage && (
              <motion.div
                ref={resultRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-display font-bold text-orange-500">Result</h3>
                  <a
                    href={resultImage}
                    download="generated-product.png"
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold shadow-lg shadow-orange-900/40 transition-all"
                  >
                    <Download className="w-5 h-5" />
                    Download Masterpiece
                  </a>
                </div>
                <div className="relative rounded-3xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl">
                  <img src={resultImage} alt="Result" className="w-full h-auto" referrerPolicy="no-referrer" />
                </div>
                
                {/* Prompt Details */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-4">
                  <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Prompt Details</h4>
                  <p className="text-zinc-300 leading-relaxed italic">"{generatedPrompt}"</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-zinc-800">
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">Aspect Ratio</p>
                      <p className="text-sm font-medium text-zinc-300">{aspectRatio}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">Lighting</p>
                      <p className="text-sm font-medium text-zinc-300">{lighting}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">Angle</p>
                      <p className="text-sm font-medium text-zinc-300">{cameraAngle}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">Composition</p>
                      <p className="text-sm font-medium text-zinc-300">{composition}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 pt-8 border-t border-zinc-900 text-center text-zinc-600 text-sm">
        <p>&copy; 2026 You're wonderful. All rights reserved.</p>
      </footer>
    </div>
  );
}
