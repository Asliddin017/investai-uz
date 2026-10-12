-- At most one open name-change request per user.
CREATE UNIQUE INDEX "NameChangeRequest_one_pending_per_user"
  ON "NameChangeRequest" ("userId")
  WHERE "status" = 'PENDING';
