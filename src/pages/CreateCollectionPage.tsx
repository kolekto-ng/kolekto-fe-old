import React from 'react';
import NavBar from '@/components/NavBar';
import CreateCollectionWizard from '@/components/collections/wizard/CreateCollectionWizard';

const CreateCollectionPage: React.FC = () => {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAFAFA]">
      <NavBar />

      <main className="px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 overflow-hidden rounded-[24px] border border-[#D8E9D9] bg-gradient-to-br from-[#F3FFF4] via-white to-[#F7FAF7] shadow-[0_20px_70px_-50px_rgba(28,92,35,0.45)] sm:mb-8 sm:rounded-[32px]">
            <div className="grid gap-5 px-4 py-5 sm:px-6 sm:py-6 md:grid-cols-[1.2fr_0.8fr] md:gap-8 md:px-10 md:py-10">
              <div className="space-y-4">
                <span className="inline-flex w-fit items-center rounded-full bg-[#1C5C23]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#1C5C23]">
                  Create Collection
                </span>
                <div className="space-y-3">
                  <h1 className="max-w-2xl text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl md:text-5xl">
                    Start collecting before you ever have to sign in.
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-gray-600 md:text-base md:leading-7">
                    Build your collection, add pricing or tiers, upload images, and review everything first. Authentication only shows up when you are ready to publish.
                  </p>
                </div>
              </div>

              <div className="rounded-[22px] border border-white/70 bg-white/80 p-4 backdrop-blur sm:rounded-[28px] sm:p-5">
                <div className="space-y-4">
                  <div className="rounded-2xl bg-[#1C5C23] px-4 py-4 text-white">
                    <p className="text-sm font-semibold">What you can do right now</p>
                    <p className="mt-1 text-sm text-white/80">
                      Choose a collection type, configure details, add tiers, and upload your campaign assets.
                    </p>
                  </div>

                  <div className="grid gap-3 text-sm text-gray-600">
                    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
                      Drafts are saved automatically, even if you refresh.
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
                      If you sign in at publish, your draft resumes and publishes from the same filled data.
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
                      No collection is permanently created until authentication succeeds.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-gray-100 bg-white px-3 py-5 shadow-sm sm:rounded-[32px] sm:px-6 sm:py-6 lg:px-8">
            <CreateCollectionWizard cancelPath="/" redirectToAuthPath="/create-collection" />
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateCollectionPage;
