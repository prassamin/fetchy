"use client";
import { AudioLines, Download, Loader2, Wand2, X } from "lucide-react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import {
  BetterImage,
  BetterVersion,
  Fallback,
  Image as Img,
} from "@/components/ui/better-image";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/video-player";
import { downloadFile, renderVideo } from "@/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FacebookStoryResponse,
  InstagramStoryResponse,
} from "@/types/api/downloader";
import { useEffect, useState } from "react";
import TrustpilotReview from "@/components/trustpilot-review-button";
import { useTranslations } from "next-intl";
import Image from "next/image";

const FBIGStoryResultView = ({
  data,
  processingTime,
}: {
  data: FacebookStoryResponse | InstagramStoryResponse;
  processingTime: string;
}) => {
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [selectedStory, setSelectedStory] = useState<
    | FacebookStoryResponse["stories"][number]
    | InstagramStoryResponse["stories"][number]
    | null
  >(data?.stories[0]);
  const rawT = useTranslations();
  const t = useTranslations("_tools");

  useEffect(() => {
    if (data) {
      const resultSection = document.getElementById("result");
      if (resultSection) {
        resultSection.scrollIntoView({
          behavior: "smooth",
        });
      }
    }
  }, [data]);

  return (
    <section id="result" className="pb-12 bg-black">
      <div className="max-w-[calc(100%-1rem)] md:container mx-auto md:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800/50 rounded-xl overflow-hidden">
            <div className="border-b border-neutral-800/50 p-4 flex justify-between items-center">
              <div className="flex items-center gap-1">
                <CheckCircleIcon className="text-neutral-400 !w-[18px] !h-5 md:!w-5" />
                <span className="text-white/80 text-sm">
                  {t("ready_to_download")}
                </span>
              </div>
              {processingTime && (
                <div className="text-xs font-mono rounded-full border border-green-500/50 px-2 py-1 bg-green-500/20 text-green-500">
                  {processingTime}
                </div>
              )}
            </div>

            <div className="flex flex-wrap mt-2 px-4 gap-2">
              {data?.stories.map((story, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedStory(story);
                  }}
                  className="h-40 aspect-[9/16] bg-gradient-to-t from-neutral-900 to-neutral-800 rounded-lg"
                >
                  <BetterImage
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="rounded-lg object-cover object-center"
                    alt={data?.id}
                    src={story?.thumbnail}
                  />
                </button>
              ))}
            </div>
            <div className="flex flex-col-reverse md:flex-row">
              <div className="md:w-1/2 p-4">
                <AspectRatio
                  ratio={9 / 16}
                  className="relative bg-muted rounded-lg"
                >
                  {/* Main Image */}
                  <BetterImage
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="rounded-lg object-cover object-center"
                    alt={selectedStory?.id || ""}
                    src={selectedStory?.thumbnail || ""}
                  />

                  <div className="absolute rounded-lg inset-0 bg-gradient-to-b from-black/40 to-transparent"></div>

                  {/* Avatar and Text */}
                  <div className="absolute top-2 ltr:left-2 rtl:right-2 flex items-center gap-1 p-1 overflow-hidden w-full">
                    <a
                      href={data?.owner?.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Image
                        className="rounded-full w-8 h-8 border border-neutral-600"
                        alt={data?.owner?.name}
                        src={data?.owner?.profile_pic}
                        width={150}
                        height={150}
                      />
                    </a>
                    <a
                      className="truncate"
                      href={data?.owner?.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <p className="text-xs font-bold text-white truncate">
                        {data?.owner?.username || data?.owner?.name}
                      </p>
                    </a>
                  </div>
                </AspectRatio>
              </div>

              <div className="md:w-1/2 p-4 flex flex-col">
                <h3 className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-lg py-2 text-sm text-neutral-400 text-center select-none mb-1.5 ">
                  {t("available_formats")}
                </h3>
                <TrustpilotReview
                  containerProps={{
                    className:
                      "z-10 w-auto overflow-hidden hover:-translate-y-0 mb-3",
                  }}
                  ambientGlowProps={{ className: "opacity-30" }}
                  className="rounded-lg bg-emerald-950/50 border-emerald-500/25 hover:border-emerald-500/25 hover:bg-emerald-950/75"
                />
                <div className="overflow-y-auto overflow-x-hidden show-scrollbar md:aspect-[9/13.5]">
                  <div className="flex flex-col gap-3">
                    {selectedStory?.resources.map(
                      (
                        res: FacebookStoryResponse["stories"][number]["resources"][number],
                        i: number,
                      ) => (
                        <Dialog key={i}>
                          <DialogTrigger asChild>
                            <div className="rounded-xl border border-neutral-800 bg-gradient-to-br from-[#1e1e1e] to-[#121212] shadow-lg p-4 flex gap-4 items-center hover:scale-[0.97] transition-transform cursor-pointer">
                              {/* Thumbnail */}
                              <div className="w-20 h-20 min-w-[80px] rounded-lg overflow-hidden bg-neutral-900 flex items-center justify-center">
                                {res.type === "audio" ? (
                                  <AudioLines className="text-neutral-400" />
                                ) : (
                                  <BetterImage
                                    src={selectedStory?.thumbnail || ""}
                                    alt="Image Preview"
                                    width={150}
                                    height={150}
                                    className="object-cover w-full h-full"
                                  />
                                )}
                              </div>

                              {/* Meta & Download */}
                              <div className="flex-1 flex flex-col justify-between">
                                <div className="flex items-center gap-1 mb-1">
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                      res.type === "video"
                                        ? "bg-purple-800/40 text-purple-300"
                                        : res.type === "audio"
                                          ? "bg-blue-800/40 text-blue-300"
                                          : "bg-green-800/40 text-green-300"
                                    }`}
                                  >
                                    {res.type.toUpperCase()}
                                  </span>
                                  {res.type === "video" && res.has_audio && (
                                    <Tooltip delayDuration={0}>
                                      <TooltipTrigger asChild>
                                        <span className="text-xs bg-blue-800/40 px-1.5 py-0.5 rounded-full">
                                          <AudioLines
                                            className="text-blue-400"
                                            size={15}
                                          />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-neutral-900/75 border border-neutral-700/50">
                                        <p>{t("has_audio")}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}

                                  {res.quality && (
                                    <span className="text-xs bg-neutral-800 px-2 py-0.5 rounded-full text-neutral-400">
                                      {res.quality}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1">
                                  {res.width && res.height && (
                                    <span>
                                      {res.width}×{res.height}
                                    </span>
                                  )}
                                  {res.bitrate && <span>{res.bitrate}</span>}
                                </div>
                              </div>
                            </div>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md p-2 z-[1500] flex flex-col items-center justify-center max-h-[95vh] gap-2 bg-neutral-900/50 backdrop-blur-[7px] border border-neutral-700/40">
                            <DialogTitle className="w-full flex flex-row items-center gap-3 justify-end">
                              <div className="flex items-center gap-2">
                                <Button
                                  onClick={() =>
                                    downloadFile(
                                      res?.baseURL,
                                      res?.filename,
                                      res?.type,
                                      setIsDownloading,
                                    )
                                  }
                                  variant="default"
                                  size="sm"
                                  className="bg-gradient-to-r from-[#7837d1] to-[#a168e3] hover:from-[#8a42e3] hover:to-[#b47aff] 
                                  text-foreground
                                  focus-visible:ring-0 transition-all duration-200 shadow-lg shadow-[#7837d1]/20 hover:shadow-[#a168e3]/30"
                                >
                                  {isDownloading ? (
                                    <Loader2 className="animate-spin mr- h-4 w-4" />
                                  ) : (
                                    <Download className="mr- h-4 w-4" />
                                  )}
                                  {rawT("download")}
                                </Button>
                                {res?.type === "video" &&
                                  !res?.has_audio &&
                                  selectedStory?.resources?.filter(
                                    (r) => r?.type === "audio",
                                  ).length > 0 && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        renderVideo(
                                          res?.baseURL,
                                          selectedStory?.resources?.filter(
                                            (r) => r?.type === "audio",
                                          )[0]?.baseURL,
                                          res?.filename,
                                          setIsRendering,
                                        )
                                      }
                                      className="bg-gradient-to-r from-amber-500/90 to-orange-500/90 text-foreground border-amber-500/30 hover:from-amber-500 hover:to-orange-500  focus-visible:ring-0 transition-all duration-200 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20"
                                    >
                                      {isRendering ? (
                                        <Loader2 className="animate-spin h-4 w-4" />
                                      ) : (
                                        <Wand2 className="h-4 w-4" />
                                      )}
                                      {t("render")}
                                    </Button>
                                  )}
                                <DialogClose asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-neutral-600/50 hover:bg-neutral-800/80 hover:border-neutral-500/50 focus-visible:ring-0 bg-transparent transition-all duration-200 aspect-square p-1"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </DialogClose>
                              </div>
                            </DialogTitle>
                            <DialogFooter className="flex w-full h-full overflow-hidden items-center justify-center">
                              {res?.type === "image" ? (
                                <BetterVersion>
                                  <Img
                                    src={res?.baseURL}
                                    width={res?.width}
                                    height={res?.height}
                                    alt={res?.id}
                                  ></Img>
                                  <Fallback className="min-h-[60dvh] max-h-full" />
                                </BetterVersion>
                              ) : res?.type === "audio" ? (
                                <audio
                                  controls
                                  src={res?.baseURL}
                                  className="rounded w-full mt-10"
                                ></audio>
                              ) : (
                                <VideoPlayer
                                  source={{
                                    sources: [{ src: res?.baseURL }],
                                    type: "video",
                                    previewThumbnails: {
                                      src: selectedStory?.thumbnail,
                                    },
                                  }}
                                ></VideoPlayer>
                              )}
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FBIGStoryResultView;
