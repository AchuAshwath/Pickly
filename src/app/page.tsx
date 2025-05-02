'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from 'next/image';
import { FolderOpen, Copy, Check, ImageOff } from 'lucide-react'; // Added ImageOff
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

// Import Lightbox and Zoom plugin
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

// Import Infinite Scroll
import InfiniteScroll from 'react-infinite-scroll-component';

interface PhotoMetadata {
    name: string;
    relativePath: string;
    fileHandle: File; // Store the File handle directly
}

interface DisplayPhoto extends PhotoMetadata {
    objectUrl: string; // URL is now only for displayed photos
}

const allowedImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const PHOTOS_PER_PAGE = 50; // How many photos to load at a time

export default function HomePage() {
    const [selectedFolderName, setSelectedFolderName] = useState<string | null>(null);
    const [allPhotos, setAllPhotos] = useState<PhotoMetadata[]>([]); // Holds metadata for ALL files
    const [visiblePhotos, setVisiblePhotos] = useState<DisplayPhoto[]>([]); // Holds photos currently rendered/loaded with URLs
    const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false); // For infinite scroll

    // State for the Lightbox viewer
    const [viewerIndex, setViewerIndex] = useState(-1);
    const [lightboxSlides, setLightboxSlides] = useState<Array<{ src: string; alt?: string; title?: string }>>([]);
    const lightboxObjectUrlsRef = useRef<string[]>([]); // URLs specifically for the open lightbox

    const fileInputRef = useRef<HTMLInputElement>(null);
    const visibleObjectUrlsRef = useRef<Set<string>>(new Set()); // Track URLs in visiblePhotos

    // --- Object URL Cleanup ---
    const revokeUrls = useCallback((urlsToRevoke: Iterable<string>) => {
        // console.log(`Revoking ${[...urlsToRevoke].length} URLs`);
        for (const url of urlsToRevoke) {
            URL.revokeObjectURL(url);
        }
    }, []);

    const revokePreviousVisibleUrls = useCallback(() => {
        // console.log("Revoking previous visible URLs");
        revokeUrls(visibleObjectUrlsRef.current);
        visibleObjectUrlsRef.current.clear();
    }, [revokeUrls]);

    const revokeLightboxUrls = useCallback(() => {
        // console.log("Revoking lightbox URLs");
        revokeUrls(lightboxObjectUrlsRef.current);
        lightboxObjectUrlsRef.current = [];
    }, [revokeUrls]);

    useEffect(() => {
        // Component unmount cleanup
        return () => {
            // console.log("Cleanup: Revoking URLs on unmount");
            revokePreviousVisibleUrls();
            revokeLightboxUrls();
        };
         // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only on mount for unmount cleanup

    const handleFolderSelectClick = () => {
        fileInputRef.current?.click();
    };

    // --- File Change Handler ---
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        revokePreviousVisibleUrls(); // Clean up old URLs first
        revokeLightboxUrls();       // Clean up lightbox URLs if it was open
        setAllPhotos([]);
        setVisiblePhotos([]);
        setSelectedPhotos(new Set());
        setSelectedFolderName(null);
        setError(null);
        setViewerIndex(-1);
        setHasMore(false);

        const files = event.target.files;
        if (!files || files.length === 0) {
            if (event.target) event.target.value = '';
            return;
        }

        setIsLoading(true);
        let localPhotoMetadata: PhotoMetadata[] = [];

        try {
            console.time("File Processing");
            const photoFiles: File[] = Array.from(files).filter(file => {
                const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
                // Basic check - consider more robust type checking if needed
                return allowedImageExtensions.includes(extension) && file.type.startsWith('image/');
            });

            if (photoFiles.length === 0) {
                setError("No supported image files found in the selected directory.");
                throw new Error("No supported images found.");
            }

            let commonPath = photoFiles[0]?.webkitRelativePath || 'Selected Folder';
            const firstSlashIndex = commonPath.indexOf('/');
            const dirName = firstSlashIndex > 0 ? commonPath.substring(0, firstSlashIndex) : commonPath.split('/')[0] || "Selected Folder";
            setSelectedFolderName(dirName);

            // Store metadata, don't create URLs yet
            for (const file of photoFiles) {
                localPhotoMetadata.push({
                    name: file.name,
                    relativePath: file.webkitRelativePath,
                    fileHandle: file // Store the file handle
                });
            }
            localPhotoMetadata.sort((a, b) => a.name.localeCompare(b.name)); // Sort metadata
            console.timeEnd("File Processing");

            setAllPhotos(localPhotoMetadata);
            setHasMore(localPhotoMetadata.length > PHOTOS_PER_PAGE); // Check if there are more beyond the first page

            // Load the first batch immediately
            console.time("First Batch Load");
            loadMorePhotos(localPhotoMetadata, []); // Pass empty initial visible photos
            console.timeEnd("First Batch Load");

        } catch (err: any) {
            console.error("Error processing files:", err);
            setError(`Error processing files: ${err.message || 'Unknown error'}`);
            toast.error("Error processing files", {
                description: err.message || 'Could not load photos from the selected folder.',
            });
            setAllPhotos([]);
            setVisiblePhotos([]);
            setSelectedFolderName(null);
            visibleObjectUrlsRef.current.clear(); // Ensure refs are clear on error
        } finally {
            setIsLoading(false);
            // Reset file input to allow selecting the same folder again
            if (event.target) event.target.value = '';
        }
    };

    // --- Load More Photos for Infinite Scroll ---
    const loadMorePhotos = useCallback((
        currentAllPhotos: PhotoMetadata[] = allPhotos,
        currentVisiblePhotos: DisplayPhoto[] = visiblePhotos
        ) => {
        // console.log("Loading more photos...");
        const startIndex = currentVisiblePhotos.length;
        const endIndex = Math.min(startIndex + PHOTOS_PER_PAGE, currentAllPhotos.length);

        if (startIndex >= currentAllPhotos.length) {
            setHasMore(false);
            // console.log("No more photos to load.");
            return;
        }

        const nextBatchMetadata = currentAllPhotos.slice(startIndex, endIndex);
        const newVisiblePhotos: DisplayPhoto[] = [];
        const newObjectUrls: string[] = [];

        // Create Object URLs ONLY for the new batch
        for (const meta of nextBatchMetadata) {
            try {
                const objectUrl = URL.createObjectURL(meta.fileHandle);
                newObjectUrls.push(objectUrl);
                visibleObjectUrlsRef.current.add(objectUrl); // Track the new URL
                newVisiblePhotos.push({
                    ...meta,
                    objectUrl: objectUrl,
                });
            } catch (urlError) {
                console.error(`Failed to create Object URL for ${meta.name}:`, urlError);
                // Optionally push a placeholder or skip the image
            }
        }

        // console.log(`Loaded ${newVisiblePhotos.length} new photos. Total visible: ${currentVisiblePhotos.length + newVisiblePhotos.length}`);
        setVisiblePhotos(prev => [...prev, ...newVisiblePhotos]);
        setHasMore(endIndex < currentAllPhotos.length);

    // Pass state directly if called outside useEffect/useCallback context (like in handleFileChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allPhotos, visiblePhotos]); // Dependencies for when called by InfiniteScroll

    // --- Photo Selection Toggle ---
    const handlePhotoSelectToggle = useCallback((photoName: string) => {
        setSelectedPhotos(prevSelected => {
            const newSelected = new Set(prevSelected);
            if (newSelected.has(photoName)) {
                newSelected.delete(photoName);
            } else {
                newSelected.add(photoName);
            }
            return newSelected;
        });
    }, []);

    // --- Handler to open the photo viewer ---
    const handleViewPhotoRequest = useCallback((requestedIndex: number) => {
        // console.log(`[HomePage] handleViewPhotoRequest called for index: ${requestedIndex}`);
        if (requestedIndex < 0 || requestedIndex >= allPhotos.length) return;

        // **Lightbox URL Generation Compromise:**
        // Generate URLs for ALL photos just before opening the lightbox.
        // Revoke them when closing.
        console.time("Lightbox URL Generation");
        revokeLightboxUrls(); // Clear any previous lightbox URLs
        const newLightboxUrls: string[] = [];
        const slidesData = allPhotos.map(photo => {
            try {
                const url = URL.createObjectURL(photo.fileHandle);
                newLightboxUrls.push(url);
                return {
                    src: url,
                    alt: photo.name,
                    title: photo.name
                };
            } catch (e) {
                 console.error(`Failed to create Object URL for lightbox slide ${photo.name}:`, e);
                 // Return a placeholder or skip
                 return { src: '', alt: `Error loading ${photo.name}`, title: photo.name };
            }
        });
        console.timeEnd("Lightbox URL Generation");

        lightboxObjectUrlsRef.current = newLightboxUrls; // Store refs to revoke later
        setLightboxSlides(slidesData);
        setViewerIndex(requestedIndex); // Set the index AFTER preparing slides
    }, [allPhotos, revokeLightboxUrls]); // Depend on allPhotos

    // --- Close Lightbox Handler ---
    const handleCloseLightbox = () => {
        setViewerIndex(-1);
        // Revoke the URLs created specifically for the lightbox
        revokeLightboxUrls();
        setLightboxSlides([]); // Clear slide data
    };

    // --- Clipboard Handler (remains the same) ---
    const handleCopyToClipboard = async () => {
        if (selectedPhotos.size === 0) return;
        setIsCopying(true);

        // IMPORTANT: Ensure the order matches the original sorted `allPhotos` list
        const orderedSelectedNames = allPhotos
            .filter(p => selectedPhotos.has(p.name)) // Filter from the master list
            .map(p => p.name);                       // Get names

        const textToCopy = orderedSelectedNames
            .map((name, index) => `${index + 1}. ${name}`)
            .join('\n');

        if (!navigator.clipboard) {
            toast.error("Copy Failed", { description: "Clipboard access requires a secure connection (HTTPS) or is not supported by your browser.", duration: 4000 });
            setIsCopying(false); return;
        }
        try {
            await navigator.clipboard.writeText(textToCopy);
            toast.success("Copied to clipboard!", { description: `${orderedSelectedNames.length} photo name${orderedSelectedNames.length === 1 ? '' : 's'} copied.`, duration: 2000 });
            setTimeout(() => setIsCopying(false), 1500);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            toast.error("Copy Failed", { description: "Could not write to clipboard. Check browser permissions." });
            setIsCopying(false);
        }
    };

    // Memoized list for display in the UI (derived from selectedPhotos and allPhotos)
     const selectedPhotoList = React.useMemo(() => {
        // Filter allPhotos based on the selectedPhotos set to maintain order
        return allPhotos
            .filter(p => selectedPhotos.has(p.name))
            .map(p => p.name);
    }, [allPhotos, selectedPhotos]);


    // --- JSX Render ---
    return (
        <>
            <Toaster richColors position="top-center" />

            <div className="container mx-auto p-4 md:p-8 space-y-6">
                <h1 className="text-3xl font-bold tracking-tight">Photo Gallery</h1>

                {/* Folder Selector Card */}
                <Card>
                    <CardHeader><CardTitle>Select Photos From Your Computer</CardTitle></CardHeader>
                    <CardContent className="flex flex-col items-start space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Click the button below to choose a folder containing images.
                            Use infinite scroll to view all images.
                            Single-click to select/deselect, double-click to view full size.
                        </p>
                        <Button onClick={handleFolderSelectClick} disabled={isLoading}>
                            <FolderOpen className="mr-2 h-4 w-4" />
                            {isLoading ? "Processing..." : "Choose Folder"}
                        </Button>
                        <input
                            type="file" ref={fileInputRef} onChange={handleFileChange}
                            style={{ display: 'none' }} directory="" webkitdirectory="" multiple
                            accept="image/png, image/jpeg, image/gif, image/webp" // Keep accept attribute
                        />
                        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
                    </CardContent>
                </Card>

                {/* Photo Display Section */}
                {selectedFolderName && !isLoading && allPhotos.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Photos in "{selectedFolderName}" ({allPhotos.length} found)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <InfiniteScroll
                                dataLength={visiblePhotos.length} // Number of items rendered so far
                                next={loadMorePhotos} // Function to call to load more
                                hasMore={hasMore} // Indicates if there are more items to load
                                loader={<p className="text-center col-span-full py-4">Loading more photos...</p>}
                                endMessage={
                                    <p className="text-center col-span-full py-4 text-muted-foreground">
                                        <b>End of list.</b>
                                    </p>
                                }
                                // Apply grid styles directly to the scrollable element
                                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
                                // Optional: Add height/max-height for scrollable area within card
                                // style={{ maxHeight: '70vh', overflow: 'auto' }}
                            >
                                {/* Map over VISIBLE photos */}
                                {visiblePhotos.map((photo) => {
                                    // Find the original index in allPhotos for lightbox linking
                                    const originalIndex = allPhotos.findIndex(p => p.relativePath === photo.relativePath);
                                    return (
                                        <PhotoCard
                                            key={photo.relativePath || photo.name} // Use a stable key
                                            // Pass the index from the *original* array
                                            index={originalIndex !== -1 ? originalIndex : 0}
                                            photo={photo} // Pass the photo with the objectUrl
                                            isSelected={selectedPhotos.has(photo.name)}
                                            onSelectToggle={handlePhotoSelectToggle}
                                            onViewRequest={handleViewPhotoRequest}
                                            onRevokeUrl={revokeUrls} // Pass revoke function if needed inside card (optional)
                                        />
                                    );
                                })}
                            </InfiniteScroll>
                        </CardContent>
                    </Card>
                )}
                {/* Show loading indicator specifically for the initial load phase */}
                {isLoading && allPhotos.length === 0 && <p className="text-center py-4">Loading photos...</p>}

                {/* Selected Photos Output Card */}
                {selectedPhotoList.length > 0 && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle>Selected Photos ({selectedPhotoList.length})</CardTitle>
                            <Button variant="outline" size="sm" onClick={handleCopyToClipboard} disabled={isCopying || selectedPhotoList.length === 0} className="transition-all">
                                {isCopying ? <Check className="mr-2 h-4 w-4 text-green-600" /> : <Copy className="mr-2 h-4 w-4" />}
                                {isCopying ? 'Copied!' : 'Copy List'}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-40 w-full rounded-md border p-4">
                                <ul className="list-decimal list-inside space-y-1 text-sm">
                                    {/* Use the memoized list which respects original order */}
                                    {selectedPhotoList.map((photoName) => (<li key={photoName}>{photoName}</li>))}
                                </ul>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Render the Lightbox component */}
            {viewerIndex >= 0 && lightboxSlides.length > 0 && ( // Conditionally render lightbox only when needed
                 <Lightbox
                     open={viewerIndex >= 0}
                     close={handleCloseLightbox} // Use specific close handler for cleanup
                     index={viewerIndex}
                     slides={lightboxSlides} // Use prepared slides
                     plugins={[Zoom]}
                     zoom={{ /* ... zoom settings ... */
                        maxZoomPixelRatio: 3,
                        zoomInMultiplier: 1.5,
                        doubleTapDelay: 300,
                        doubleClickDelay: 300,
                        doubleClickMaxStops: 2,
                        keyboardMoveDistance: 50,
                        wheelZoomDistanceFactor: 100,
                        pinchZoomDistanceFactor: 100,
                        scrollToZoom: true,
                     }}
                 />
             )}
        </>
    );
}

// --- Photo Card Component (Modified) ---
interface PhotoCardProps {
    photo: DisplayPhoto; // Expects objectUrl to be present
    index: number;       // Index in the original allPhotos array
    isSelected: boolean;
    onSelectToggle: (photoName: string) => void;
    onViewRequest: (index: number) => void;
    onRevokeUrl?: (urls: string[]) => void; // Optional: For potential future direct revocation needs
}

const PhotoCard = React.memo(({ photo, index, isSelected, onSelectToggle, onViewRequest, onRevokeUrl }: PhotoCardProps) => {
    const cardId = `photo-card-${photo.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [imageError, setImageError] = useState(false);

    // Cleanup Object URL when component unmounts (important for virtualization)
    // Note: This works well with react-infinite-scroll-component as items *stay*
    // in the DOM but are loaded lazily. For true virtualization (like react-window)
    // where components truly unmount when scrolled away, this is critical.
    useEffect(() => {
        const urlToRevoke = photo.objectUrl; // Capture url at mount time
        return () => {
            if (urlToRevoke && urlToRevoke.startsWith('blob:')) {
                // console.log(`PhotoCard unmount/cleanup: Revoking URL for ${photo.name}`);
                 // Option 1: Let HomePage handle revocation via refs (less direct)
                 // Option 2: Pass revoke function (more direct but adds prop drilling)
                 // if (onRevokeUrl) {
                 //     onRevokeUrl([urlToRevoke]);
                 // } else {
                 //     URL.revokeObjectURL(urlToRevoke);
                 // }
                 // Sticking with simpler direct revocation here for now:
                 URL.revokeObjectURL(urlToRevoke);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only on mount/unmount

    // Single/Double Click Handling (same as before)
    const handleClick = useCallback(() => {
        if (clickTimeoutRef.current) { // Double click detected
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
            // console.log(`Double click on index: ${index}`);
            onViewRequest(index); // Trigger view request on double click
        } else { // Prepare for single click
            clickTimeoutRef.current = setTimeout(() => {
                // console.log(`Single click on index: ${index}`);
                onSelectToggle(photo.name); // Trigger select toggle on single click
                clickTimeoutRef.current = null;
            }, 250); // Adjust delay as needed
        }
    }, [onSelectToggle, onViewRequest, photo.name, index]);

    // Cleanup timeout on unmount
    useEffect(() => {
        const timeoutId = clickTimeoutRef.current;
        return () => { if (timeoutId) clearTimeout(timeoutId); };
    }, []);

    const handleImageError = useCallback(() => {
        console.warn(`Failed to load image preview: ${photo.name}`);
        setImageError(true);
        // Optionally revoke the broken URL immediately
        if (photo.objectUrl.startsWith('blob:')) {
             URL.revokeObjectURL(photo.objectUrl);
        }
    },[photo.name, photo.objectUrl]);

    return (
        <Card
            className={`overflow-hidden cursor-pointer transition-all duration-200 ease-in-out relative group ${
                isSelected ? 'ring-2 ring-primary ring-offset-2' : 'hover:shadow-md'
            } ${imageError ? 'bg-destructive/10' : 'bg-muted/30'}`} // Add background on error
             // Use onClick for combined single/double click logic
            onClick={handleClick}
            role="button" aria-pressed={isSelected} aria-label={`Photo: ${photo.name}`} tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectToggle(photo.name); } }} // Keep Enter/Space for selection
        >
            <CardContent className="p-0 aspect-square relative">
                {imageError ? (
                     <div className="absolute inset-0 flex flex-col items-center justify-center text-destructive/80 p-2">
                         <ImageOff className="w-1/3 h-1/3 mb-1" />
                         <p className="text-xs text-center line-clamp-2">{photo.name}</p>
                         <p className="text-xs font-semibold mt-1">Load Error</p>
                     </div>
                 ) : (
                    <Image
                        src={photo.objectUrl}
                        alt="" // Decorative, alt text is handled by aria-label on card
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
                        style={{ objectFit: 'contain' }} // Use contain to see whole image
                        priority={false} // Lower priority for gallery images
                        quality={70} // Slightly lower quality for thumbs
                        onError={handleImageError}
                        draggable="false"
                        className="transition-transform duration-200 group-hover:scale-105"
                        decoding="async" // Hint browser to decode off main thread
                    />
                 )}
                {/* Checkbox remains visible even on error */}
                <div className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm rounded-full p-0.5 pointer-events-none">
                    <Checkbox id={cardId} checked={isSelected} aria-hidden="true" tabIndex={-1} className="w-5 h-5" />
                </div>
            </CardContent>
        </Card>
    );
});
PhotoCard.displayName = 'PhotoCard';