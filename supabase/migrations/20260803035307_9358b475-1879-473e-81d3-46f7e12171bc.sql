REVOKE ALL ON FUNCTION public.next_print_order_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_print_order_number() TO service_role;