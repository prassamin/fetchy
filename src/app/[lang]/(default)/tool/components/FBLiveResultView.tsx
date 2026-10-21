"use client";
import { AudioLines, Copy, CopyCheck } from "lucide-react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { BetterImage } from "@/components/ui/better-image";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FacebookVideoResource,
  FacebookVideoResponse,
} from "@/types/api/downloader";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import TrustpilotReview from "@/components/trustpilot-review-button";
import { useTranslations } from "next-intl";
import Image from "next/image";

const FBLiveResultView = ({
  data,
  processingTime,
}: {
  data: FacebookVideoResponse;
  processingTime: string;
}) => {
  const [isCopying, setIsCopying] = useState<boolean>(false);
  const rawT = useTranslations();
  const t = useTranslations("_tools");

  const copyToClipboard = (text: string) => {
    setIsCopying(true);
    navigator.clipboard.writeText(text);
    toast.success("Copied!", {
      description: t("dash_copied_message"),
    });
    setTimeout(() => setIsCopying(false), 2000);
  };

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
                    alt={data?.id}
                    src={data?.thumbnail || ""}
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
                  {t("live_formats")}
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
                    {data?.resources.map(
                      (res: FacebookVideoResource, i: number) => (
                        <Dialog key={i}>
                          <DialogTrigger asChild>
                            <div className="rounded-xl border border-neutral-800 bg-gradient-to-br from-[#1e1e1e] to-[#121212] shadow-lg p-4 flex gap-4 items-center hover:scale-[0.97] transition-transform cursor-pointer">
                              {/* Thumbnail */}
                              <div className="w-20 h-20 min-w-[80px] rounded-lg overflow-hidden bg-neutral-900 flex items-center justify-center">
                                {res.type === "audio" ? (
                                  <AudioLines className="text-neutral-400" />
                                ) : (
                                  <BetterImage
                                    src={res.thumbnail || ""}
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

                                  {data.type === "live" && (
                                    <span className="text-xs bg-red-700/40 uppercase text-red-300 px-1.5 py-0.5 rounded-full">
                                      {t("live")}
                                    </span>
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
                          <DialogContent className="sm:max-w-md p-4 z-[1500] flex flex-col bg-neutral-900/50 backdrop-blur-[12px] border border-neutral-700/40 rounded-2xl shadow-xl">
                            <DialogTitle className="text-center text-lg font-semibold tracking-wide text-white mb-6">
                              {t("live_stream_info")}
                            </DialogTitle>

                            <div className="space-y-5 text-sm text-neutral-300">
                              <p
                                className="leading-relaxed text-muted-foreground"
                                dangerouslySetInnerHTML={{
                                  __html: t.raw("live_stream_info_message"),
                                }}
                              />

                              <div className="space-y-1">
                                <p className="text-white font-medium">
                                  {t("platform_url", {
                                    platform: "DASH",
                                  })}
                                </p>
                                <div className="flex items-center gap-2">
                                  <code className="flex-1 p-3 bg-neutral-800/60 rounded-md text-xs text-white font-mono backdrop-blur-sm border border-neutral-700/30 truncate">
                                    {res?.baseURL}
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm transition-all"
                                    onClick={() =>
                                      copyToClipboard(res?.baseURL)
                                    }
                                    disabled={isCopying}
                                  >
                                    {isCopying ? (
                                      <CopyCheck className="h-4 w-4" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>

                            <div className="mt-8 flex justify-end">
                              <DialogClose asChild>
                                <Button
                                  variant="outline"
                                  className="text-white hover:bg-white/10 bg-white/5 transition-all"
                                >
                                  {rawT("close")}
                                </Button>
                              </DialogClose>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )
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

export default FBLiveResultView;
