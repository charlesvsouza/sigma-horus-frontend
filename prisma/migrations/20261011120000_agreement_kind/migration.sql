-- Tipo do acordo: "regularization" (dívidas + taxa de regularização, como sempre foi) ou
-- "settlement" (só quitação das dívidas com a loja, sem taxa e sem regularizar o irmão).
ALTER TABLE "MemberBlock" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'regularization';
