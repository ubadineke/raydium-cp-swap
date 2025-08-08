use anchor_lang::{
    prelude::*,
    solana_program::{instruction::Instruction, program::invoke},
    system_program::{create_account, CreateAccount},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenInterface},
};
use spl_tlv_account_resolution::state::ExtraAccountMetaList;
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    payer: Signer<'info>,

    /// CHECK: ExtraAccountMetaList Account, must use these seeds
    #[account(
        mut,
        seeds = [b"extra-account-metas", mint.key().as_ref()], 
        bump,
        seeds::program = transfer_hook_program.key()
    )]
    pub extra_account_meta_list: AccountInfo<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    /// CHECK: The transfer hook program (needed for PDA derivation)
    pub transfer_hook_program: UncheckedAccount<'info>,
}

// pub fn initialize_extra_account_meta_list(
//   ctx: Context<InitializeExtraAccountMetaList>,
// ) -> Result<()> {

//   // The `addExtraAccountsToInstruction` JS helper function resolving incorrectly
//   let account_metas = vec![

//   ];

//   // calculate account size
//   let account_size = ExtraAccountMetaList::size_of(account_metas.len())? as u64;
//   // calculate minimum required lamports
//   let lamports = Rent::get()?.minimum_balance(account_size as usize);

//   let mint = ctx.accounts.mint.key();
//   let signer_seeds: &[&[&[u8]]] = &[&[
//       b"extra-account-metas",
//       &mint.as_ref(),
//       &[ctx.bumps.extra_account_meta_list],
//   ]];

//   // create ExtraAccountMetaList account
//   create_account(
//       CpiContext::new(
//           ctx.accounts.system_program.to_account_info(),
//           CreateAccount {
//               from: ctx.accounts.payer.to_account_info(),
//               to: ctx.accounts.extra_account_meta_list.to_account_info(),
//           },
//       )
//       .with_signer(signer_seeds),
//       lamports,
//       account_size,
//       ctx.program_id,
//   )?;

//   // initialize ExtraAccountMetaList account with extra accounts
//   ExtraAccountMetaList::init::<ExecuteInstruction>(
//       &mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,
//       &account_metas,
//   )?;

//   Ok(())
// }

pub fn initialize_hook_for_mint(ctx: Context<InitializeExtraAccountMetaList>) -> Result<()> {
    // Validate the PDA is correct for the transfer hook program
    // let (expected_pda, _bump) = Pubkey::find_program_address(
    //     &[
    //         b"extra-account-metas",
    //         ctx.accounts.mint.key().as_ref(),
    //     ],
    //     &ctx.accounts.transfer_hook_program.key(),
    // );

    // require_keys_eq!(
    //     ctx.accounts.extra_account_meta_list.key(),
    //     expected_pda,
    //     "Invalid extra account meta list PDA"
    // );

    // Use the exact discriminator from the IDL
    let discriminator: [u8; 8] = [92, 197, 174, 197, 41, 124, 19, 3];

    let accounts = vec![
        AccountMeta::new(ctx.accounts.payer.key(), true),
        AccountMeta::new(ctx.accounts.extra_account_meta_list.key(), false),
        AccountMeta::new_readonly(ctx.accounts.mint.key(), false),
        AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
        AccountMeta::new_readonly(ctx.accounts.associated_token_program.key(), false),
        AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
    ];

    let instruction = Instruction {
        program_id: ctx.accounts.transfer_hook_program.key(),
        accounts,
        data: discriminator.to_vec(),
    };

    let account_infos = vec![
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.extra_account_meta_list.to_account_info(),
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.associated_token_program.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        ctx.accounts.transfer_hook_program.to_account_info(),
    ];

    invoke(&instruction, &account_infos)?;

    msg!("Successfully initialized extra account meta list via CPI");
    Ok(())
}
