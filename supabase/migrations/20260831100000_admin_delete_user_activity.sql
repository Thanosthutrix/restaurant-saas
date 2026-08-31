-- Journal support : action suppression compte utilisateur

ALTER TABLE public.admin_support_activities
  DROP CONSTRAINT IF EXISTS chk_admin_support_activities_action;

ALTER TABLE public.admin_support_activities
  ADD CONSTRAINT chk_admin_support_activities_action CHECK (
    action IN (
      'note', 'email_sent', 'impersonate', 'suspend', 'unsuspend',
      'trial_granted', 'reset_password', 'prospect_note', 'prospect_status',
      'prospect_created', 'invoice_viewed',
      'trial_request_approved', 'trial_request_rejected',
      'user_deleted'
    )
  );
